"""JavaScript arithmetic semantics for the port of ``frontend/src/engine``.

The TypeScript engine runs on IEEE doubles and never throws on arithmetic: ``Math.pow`` of a negative base with a
fractional exponent is NaN, ``Math.exp`` overflows to Infinity, a division by zero is Infinity or NaN, and
``Math.max`` and ``Math.min`` return NaN when any argument is NaN. Python raises or orders differently in each of
those cases. The engine returns a flagged result for an out-of-domain operating point (a negative feed size, a
negative CSS), so the port needs the same values, not an exception. These helpers are the only place where the
two languages differ; every other operation is the same IEEE double operation in the same order.
"""
from __future__ import annotations

import math


def is_nan(x: float) -> bool:
    return x != x


def jpow(x: float, y: float) -> float:
    """``Math.pow``: NaN for a negative base with a non-integer exponent, Infinity on overflow or 0 ** negative."""
    try:
        return math.pow(x, y)
    except ValueError:
        if x == 0:
            return math.inf
        return math.nan
    except OverflowError:
        if x < 0 and float(y).is_integer() and int(y) % 2 == 1:
            return -math.inf
        return math.inf


def jexp(x: float) -> float:
    """``Math.exp``: Infinity on overflow."""
    try:
        return math.exp(x)
    except OverflowError:
        return math.inf


def jlog(x: float) -> float:
    """``Math.log``: -Infinity at 0, NaN below 0."""
    if is_nan(x):
        return math.nan
    if x == 0:
        return -math.inf
    if x < 0:
        return math.nan
    return math.log(x)


def jfloor(x: float) -> float:
    """``Math.floor``: NaN and the infinities are returned as they are (``math.floor`` raises on them)."""
    if is_nan(x) or math.isinf(x):
        return x
    return float(math.floor(x))


def jsqrt(x: float) -> float:
    """``Math.sqrt``: NaN below 0."""
    if is_nan(x) or x < 0:
        return math.nan
    return math.sqrt(x)


def jdiv(a: float, b: float) -> float:
    """``a / b`` with IEEE division by zero: signed Infinity, or NaN for 0 / 0."""
    if b == 0:
        if a == 0 or is_nan(a):
            return math.nan
        return math.copysign(math.inf, a) * math.copysign(1.0, b)
    return a / b


def jmax(*xs: float) -> float:
    """``Math.max``: NaN when any argument is NaN."""
    if any(is_nan(x) for x in xs):
        return math.nan
    return max(xs)


def jmin(*xs: float) -> float:
    """``Math.min``: NaN when any argument is NaN."""
    if any(is_nan(x) for x in xs):
        return math.nan
    return min(xs)


def or_one(x: float) -> float:
    """``x || 1`` for a number: 1 when x is 0 or NaN (both falsy in JavaScript; NaN is truthy in Python)."""
    return 1.0 if (x == 0 or is_nan(x)) else x
