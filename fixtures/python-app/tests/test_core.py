from pyapp.core import run


def test_run(capsys):
    run("tester")
    captured = capsys.readouterr()
    assert "Hello, tester!" in captured.out
