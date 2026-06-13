def validate_user_profile(data: dict) -> dict:
    """
    Validates user profile JSON data. 
    Returns a dict with {"is_valid": bool, "error": str_or_None}.
    """
    if not isinstance(data, dict):
        return {"is_valid": False, "error": "Profile data must be a JSON object."}

    # Check required top-level keys
    required_keys = ["education", "experience", "interested_industries", "hard_skills", "languages"]
    for key in required_keys:
        if key not in data:
            return {"is_valid": False, "error": f"Missing required key: {key}"}

    # Validate education (list of dicts)
    if not isinstance(data["education"], list):
        return {"is_valid": False, "error": "'education' must be a list."}

    # Validate experience (list of dicts)
    if not isinstance(data["experience"], list):
        return {"is_valid": False, "error": "'experience' must be a list."}

    # Validate interested_industries (list of strings)
    if not isinstance(data["interested_industries"], list):
        return {"is_valid": False, "error": "'interested_industries' must be a list."}
    
    # Validate hard_skills
    if not isinstance(data["hard_skills"], list):
        return {"is_valid": False, "error": "'hard_skills' must be a list."}
    for skill in data["hard_skills"]:
        if not isinstance(skill, dict):
            return {"is_valid": False, "error": "Each hard_skill must be an object."}
        if "name" not in skill:
            return {"is_valid": False, "error": "hard_skill must contain 'name'."}

    # Validate languages
    if not isinstance(data["languages"], list):
        return {"is_valid": False, "error": "'languages' must be a list."}
    for lang in data["languages"]:
        if not isinstance(lang, dict):
            return {"is_valid": False, "error": "Each language must be an object."}
        if "name" not in lang or "proficiency_level" not in lang:
            return {"is_valid": False, "error": "language must contain 'name' and 'proficiency_level'."}

    return {"is_valid": True, "error": None}
