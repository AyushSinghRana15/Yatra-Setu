"""Health-readiness self-check (SF-4: FR-18 to FR-20).

Rule-based and deliberately conservative. It does NOT diagnose; it sorts travellers into
readiness categories and points them to official screening and medical posts.
"""
from .risk import NODES, TRIPS, SEGMENTS

RED_FLAGS = {
    "chest_pain": "Chest pain or pressure",
    "breathless_rest": "Breathlessness at rest",
    "recent_surgery": "Major surgery or heart attack in the last 6 months",
    "fainting": "Recent fainting or uncontrolled dizziness",
}
CONDITIONS = {
    "heart": "Heart disease", "bp": "High blood pressure", "diabetes": "Diabetes",
    "asthma": "Asthma / COPD / lung disease", "pregnancy": "Pregnancy",
}


def assess(age: int, conditions: list[str], red_flags: list[str], fitness: str, shrine: str):
    """Return category (Ready / Caution / Consult doctor first / Do not trek now) with reasons and actions."""
    reasons, actions = [], []
    if red_flags:
        cat = "Do not trek now"
        reasons += [RED_FLAGS[r] for r in red_flags if r in RED_FLAGS]
        actions += ["Do not start the trek. Visit the nearest medical relief post or hospital today.",
                    "In an emergency call 112 (or 108 for an ambulance)."]
    else:
        points = 0
        if age >= 60:
            points += 2; reasons.append("Age 60 or above")
        elif age >= 50:
            points += 1; reasons.append("Age 50 or above")
        for c in conditions:
            if c in CONDITIONS:
                points += 2 if c in ("heart", "asthma", "pregnancy") else 1
                reasons.append(CONDITIONS[c])
        if fitness == "low":
            points += 1; reasons.append("Low walking fitness (cannot walk 5 km comfortably)")
        cat = "Ready" if points == 0 else "Caution" if points <= 2 else "Consult doctor first"
        if cat == "Consult doctor first":
            actions.append("Get a doctor's fitness certificate before travelling; consider pony, palki or helicopter instead of walking.")
        if cat != "Ready":
            actions.append("Rest a night at an intermediate halt to acclimatise; walk slowly with breaks.")
        actions.append("Carry your regular medicines and prescriptions; drink enough water; keep warm.")
    if age >= 50:
        actions.insert(0, "Health screening is mandatory for pilgrims aged 50+: get screened at the screening point on your route.")
    # FR-19 / FR-20: screening points and medical posts along the chosen route
    nodes = []
    for sid in TRIPS.get(shrine, []):
        for n in (SEGMENTS[sid]["from"], SEGMENTS[sid]["to"]):
            if n not in nodes:
                nodes.append(n)
    screening = [NODES[n]["name"] for n in nodes if "screening" in NODES[n]["facilities"]]
    medical = [NODES[n]["name"] for n in nodes if {"medical", "hospital"} & set(NODES[n]["facilities"])]
    return {"category": cat, "reasons": reasons, "actions": actions,
            "screening_points": screening, "medical_posts": medical,
            "disclaimer": "This is general readiness guidance, not a medical diagnosis. Follow doctors and official health advisories."}
