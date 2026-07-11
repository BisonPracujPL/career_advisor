import copy
import json
import os

import numpy as np

# Load prompts globally
PROMPTS_FILE = os.path.join(os.path.dirname(__file__), "prompts.json")
SUGGESTION_POOL_SIZE = 7
DEFAULT_SUGGESTION_K = 4


def load_prompts():
    try:
        with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


PROMPTS = load_prompts()
PROMPT_EMBEDDINGS = None


def _industry_role_labels(industries: list) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for item in industries or []:
        if isinstance(item, str):
            name = item.strip()
        elif isinstance(item, dict):
            main = (item.get("main") or "").strip()
            subs = item.get("subs") or []
            for sub in subs:
                sub = (sub or "").strip()
                if not sub or sub == "__ALL__":
                    continue
                name = sub
                labels.append(name)
                seen.add(name.lower())
            if subs:
                continue
            name = main
        else:
            continue
        if name and name.lower() not in seen:
            labels.append(name)
            seen.add(name.lower())
    return labels


def _profile_prompt_labels(profile_data: dict | None) -> dict[str, str]:
    """Fill chip placeholders from CV, branże and DB segments."""
    profile_data = profile_data or {}
    try:
        from apps.job_market.services.career_chat_context import build_chat_facts

        bundle = build_chat_facts(profile_data)
        facts = bundle.get("facts") or {}
        market_ctx = bundle.get("market_ctx") or {}
    except Exception:
        facts = {}
        market_ctx = {}

    experience = profile_data.get("experience") or []
    past_titles = [
        (e.get("job_title") or "").strip()
        for e in experience
        if (e.get("job_title") or "").strip()
    ]

    industry_labels = _industry_role_labels(profile_data.get("interested_industries"))
    top_segs = facts.get("top_segments") or market_ctx.get("top_segments") or []
    seg_labels = [
        (s.get("display_label") or s.get("label") or "").strip()
        for s in top_segs
        if (s.get("display_label") or s.get("label"))
    ]

    missing = facts.get("missing_skills") or []
    skill_name = (missing[0].get("name") if missing else "") or "priorytetowy skill"

    best = facts.get("best_segment") or {}
    segment = (
        best.get("display_label")
        or market_ctx.get("best_segment")
        or (seg_labels[0] if seg_labels else "Twój segment rynku")
    )

    candidates: list[str] = []
    seen_lower: set[str] = set()

    def _add(label: str) -> None:
        text = (label or "").strip()
        if text and text.lower() not in seen_lower:
            candidates.append(text)
            seen_lower.add(text.lower())

    for title in past_titles[:4]:
        _add(title)
    for label in industry_labels:
        _add(label)
    for label in seg_labels[:4]:
        _add(label)

    role_a = candidates[0] if candidates else "Frontend Developer"
    role_b = candidates[1] if len(candidates) > 1 else "Analityk danych"
    if role_b.lower() == role_a.lower():
        role_b = candidates[2] if len(candidates) > 2 else "Analityk danych"

    return {
        "segment": segment,
        "role_a": role_a,
        "role_b": role_b,
        "skill": skill_name,
        "industry": industry_labels[0] if industry_labels else segment,
    }


def _rotate_prompt_indices(
    ranked_indices: list[int],
    *,
    k: int,
    turn_index: int,
    pool_size: int,
) -> list[int]:
    """Pick k indices from top pool with a sliding window so chips change each turn."""
    pool = ranked_indices[:pool_size]
    if len(pool) <= k:
        return pool

    max_start = len(pool) - k
    start = turn_index % (max_start + 1)
    return pool[start : start + k]


def get_top_k_prompts(
    context_text: str,
    embedding_model,
    k: int = DEFAULT_SUGGESTION_K,
    *,
    exclude_ids: list[str] | None = None,
    turn_index: int = 0,
):
    """
    Return k prompts from a pool of 7. Chips rotate with each conversation turn;
    semantic similarity still influences ordering within the pool.
    """
    global PROMPT_EMBEDDINGS

    prompts = load_prompts()
    if not prompts:
        return []

    # Exclude at most the last clicked chip — always return k=4 suggestions.
    exclude = set((exclude_ids or [])[:1])
    pool_size = min(SUGGESTION_POOL_SIZE, len(prompts))

    if PROMPT_EMBEDDINGS is None or len(PROMPT_EMBEDDINGS) != len(prompts):
        texts_to_embed = [f"{p['short_desc']}. {p['prompt']}" for p in prompts]
        PROMPT_EMBEDDINGS = embedding_model.encode(texts_to_embed)

    def _pick_k_from_indices(ranked_indices: list[int]) -> list:
        available = [i for i in ranked_indices if prompts[i].get("id") not in exclude]
        if len(available) < k:
            available = list(ranked_indices)
        pool = available[:pool_size]
        chosen = _rotate_prompt_indices(
            pool,
            k=k,
            turn_index=turn_index,
            pool_size=min(pool_size, len(pool)),
        )
        return [prompts[i] for i in chosen]

    if not context_text.strip():
        ranked = list(range(len(prompts)))
        return _pick_k_from_indices(ranked)

    context_vector = embedding_model.encode([context_text])[0]
    norm_prompts = np.linalg.norm(PROMPT_EMBEDDINGS, axis=1, keepdims=True)
    norm_context = np.linalg.norm(context_vector)
    norm_prompts[norm_prompts == 0] = 1

    if norm_context == 0:
        ranked = list(range(len(prompts)))
        return _pick_k_from_indices(ranked)

    similarities = np.dot(PROMPT_EMBEDDINGS, context_vector) / (
        norm_prompts.squeeze() * norm_context
    )

    ranked = sorted(range(len(prompts)), key=lambda i: float(similarities[i]), reverse=True)
    return _pick_k_from_indices(ranked)


def fill_prompt_variables_from_facts(prompts_list, profile_data: dict | None):
    """Replace placeholders with profile + DB-backed labels."""
    labels = _profile_prompt_labels(profile_data)
    out = []
    for p in prompts_list:
        item = copy.deepcopy(p)
        for field in ("short_desc", "prompt"):
            if field in item and isinstance(item[field], str):
                item[field] = (
                    item[field]
                    .replace("[Stanowisko]", labels["segment"])
                    .replace("[Branża]", labels["industry"])
                    .replace("[Rola A]", labels["role_a"])
                    .replace("[Rola B]", labels["role_b"])
                    .replace("[Umiejętność]", labels["skill"])
                )
        out.append(item)
    return out


def fill_prompt_variables_with_llm(prompts_list, profile_data, recent_messages):
    """
    Legacy LLM fill — prefer fill_prompt_variables_from_facts for numeric safety.
    Falls back to DB segment label when LLM unavailable.
    """
    openrouter_key = os.environ.get("OPEN_ROUTER_API_KEY", "")
    if not openrouter_key or openrouter_key == "set_me_up":
        return fill_prompt_variables_from_facts(prompts_list, profile_data)

    try:
        from openai import OpenAI

        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_key,
        )

        labels = _profile_prompt_labels(profile_data)

        system_instruction = (
            "Zamień placeholdery [Stanowisko], [Branża], [Rola A], [Rola B] na podane etykiety. "
            "NIE wymyślaj liczb ani nowych stanowisk. Zwróć JSON array z polami "
            "id, short_desc, prompt, icon."
        )

        user_context = (
            f"Etykiety z profilu (użyj dokładnie):\n"
            f"- [Stanowisko]: {labels['segment']}\n"
            f"- [Branża]: {labels['industry']}\n"
            f"- [Rola A]: {labels['role_a']}\n"
            f"- [Rola B]: {labels['role_b']}\n"
            f"- [Umiejętność]: {labels['skill']}\n"
            f"Profil (skrót): {json.dumps(profile_data or {}, ensure_ascii=False)[:2000]}\n"
            f"Ostatnie wiadomości:\n"
            + "\n".join(
                [
                    f"{m.get('role')}: {m.get('content')}"
                    for m in (recent_messages or [])
                    if isinstance(m, dict)
                ]
            )
        )

        input_prompts_json = json.dumps(prompts_list, ensure_ascii=False)
        user_prompt = f"{user_context}\n\nPrompty:\n{input_prompts_json}"

        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=1500,
            temperature=0.1,
        )

        content = response.choices[0].message.content.strip()

        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        filled_prompts = json.loads(content.strip())

        if isinstance(filled_prompts, list) and len(filled_prompts) == len(prompts_list):
            return filled_prompts

    except Exception as e:
        print(f"Error filling prompts with LLM: {e}")

    return fill_prompt_variables_from_facts(prompts_list, profile_data)
