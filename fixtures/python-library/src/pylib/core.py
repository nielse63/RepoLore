from ._internal.rounding import round_value


def add(a: float, b: float) -> float:
    return round_value(a + b)


def multiply(a: float, b: float) -> float:
    return round_value(a * b)
