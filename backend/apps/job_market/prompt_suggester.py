import json
import os
import numpy as np

# Load prompts globally
PROMPTS_FILE = os.path.join(os.path.dirname(__file__), "prompts.json")

def load_prompts():
    try:
        with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

PROMPTS = load_prompts()
PROMPT_EMBEDDINGS = None

def get_top_k_prompts(context_text: str, embedding_model, k: int = 4):
    """
    Returns the top K prompts that semantically match the context_text.
    If context_text is empty, returns first K prompts as default.
    """
    global PROMPT_EMBEDDINGS
    
    if not PROMPTS:
        return []

    # Calculate embeddings for prompts if not already done
    if PROMPT_EMBEDDINGS is None:
        # We embed the short_desc + prompt for better context matching
        texts_to_embed = [f"{p['short_desc']}. {p['prompt']}" for p in PROMPTS]
        PROMPT_EMBEDDINGS = embedding_model.encode(texts_to_embed)

    if not context_text.strip():
        # Fallback to random or first K if no context
        return PROMPTS[:k]

    context_vector = embedding_model.encode([context_text])[0]
    
    # Calculate cosine similarity manually using numpy
    # (dot product of normalized vectors)
    norm_prompts = np.linalg.norm(PROMPT_EMBEDDINGS, axis=1, keepdims=True)
    norm_context = np.linalg.norm(context_vector)
    
    # Avoid division by zero
    norm_prompts[norm_prompts == 0] = 1
    if norm_context == 0:
        return PROMPTS[:k]

    similarities = np.dot(PROMPT_EMBEDDINGS, context_vector) / (norm_prompts.squeeze() * norm_context)
    
    # Get indices of top K
    top_indices = np.argsort(similarities)[::-1][:k]
    
    return [PROMPTS[i] for i in top_indices]

def fill_prompt_variables_with_llm(prompts_list, profile_data, recent_messages):
    """
    Uses an LLM (via OpenRouter) to fill in the [Variables] in the prompts 
    based on user profile and chat context.
    Returns a new list of prompts with filled values.
    """
    openrouter_key = os.environ.get("OPEN_ROUTER_API_KEY", "")
    if not openrouter_key or openrouter_key == "set_me_up":
        return prompts_list # Fallback to original if no key

    try:
        from openai import OpenAI
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_key,
        )
        
        # Format input for LLM
        system_instruction = (
            "Jesteś pomocnikiem systemu AI. Twoim zadaniem jest zamienić placeholdery w nawiasach kwadratowych "
            "(np. [Stanowisko], [Branża], [Umiejętność]) w podanych promptach i ich opisach na rzeczywiste wartości "
            "najlepiej pasujące do profilu użytkownika lub kontekstu rozmowy.\n\n"
            "Zwróć wynik jako JSON array zawierający obiekty z wypełnionymi 'short_desc' oraz 'prompt'. "
            "Zachowaj oryginalne 'id' oraz 'icon'. Odpowiadaj wyłącznie poprawnym JSON-em (bez formatowania Markdown i bloków kodu, sam tekst JSON)."
        )
        
        user_context = (
            f"Profil użytkownika (JSON): {json.dumps(profile_data, ensure_ascii=False)}\n"
            f"Ostatnie wiadomości czatu:\n"
            + "\n".join([f"{m.get('role')}: {m.get('content')}" for m in recent_messages if isinstance(m, dict)])
        )
        
        input_prompts_json = json.dumps(prompts_list, ensure_ascii=False)
        
        user_prompt = f"{user_context}\n\nPrompty do uzupełnienia:\n{input_prompts_json}"

        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=1500,
            temperature=0.3
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean markdown codeblocks if LLM adds them despite instructions
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        filled_prompts = json.loads(content.strip())
        
        # Basic validation
        if isinstance(filled_prompts, list) and len(filled_prompts) == len(prompts_list):
            return filled_prompts
        else:
            return prompts_list
            
    except Exception as e:
        print(f"Error filling prompts with LLM: {e}")
        return prompts_list
