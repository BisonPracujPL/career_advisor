"""Normalize offer salary bands to comparable monthly PLN amounts."""

from __future__ import annotations

# Full-time norm used for hourly → monthly conversion (≈21 × 8 h).
HOURS_PER_MONTH = 168


def salary_midpoint(from_val, to_val) -> float | None:
    if from_val is None:
        return None
    lo = float(from_val)
    if lo <= 0:
        return None
    hi = float(to_val) if to_val and float(to_val) > 0 else lo
    return (lo + hi) / 2.0


def salary_unit(duration: str | None) -> str | None:
    d = (duration or "").lower().strip()
    if not d:
        return None
    if "godz" in d or "hour" in d or d == "hr":
        return "hourly"
    if "mies" in d or "month" in d:
        return "monthly"
    return None


def monthly_pln(from_val, to_val, duration: str | None) -> float | None:
    """Return salary midpoint converted to PLN / month, or None if unit unknown."""
    mid = salary_midpoint(from_val, to_val)
    if mid is None:
        return None
    unit = salary_unit(duration)
    if unit == "hourly":
        return mid * HOURS_PER_MONTH
    if unit == "monthly":
        return mid
    return None


def offer_monthly_pln(
    uop_from,
    uop_to,
    uop_duration,
    b2b_from,
    b2b_to,
    b2b_duration,
) -> float | None:
    """Prefer UoP band; fall back to B2B. Values normalized to monthly PLN."""
    uop = monthly_pln(uop_from, uop_to, uop_duration)
    if uop is not None:
        return uop
    return monthly_pln(b2b_from, b2b_to, b2b_duration)
