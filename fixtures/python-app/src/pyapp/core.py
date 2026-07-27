from .utils import greeting


def run(name: str = "world") -> None:
    print(greeting(name))
