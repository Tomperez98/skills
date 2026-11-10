import random

import pytest

from tryagain import RetryExhausted, retry


def flaky(failures: int):
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        if calls["n"] <= failures:
            raise ConnectionError(f"attempt {calls['n']}")
        return "ok"

    return fn, calls


def test_returns_after_transient_failures():
    fn, calls = flaky(2)
    assert retry(fn, attempts=3, sleep=lambda _: None) == "ok"
    assert calls["n"] == 3


def test_raises_with_every_error_when_exhausted():
    fn, _ = flaky(5)
    with pytest.raises(RetryExhausted) as info:
        retry(fn, attempts=3, sleep=lambda _: None)
    assert [str(e) for e in info.value.errors] == [
        "attempt 1",
        "attempt 2",
        "attempt 3",
    ]


def test_delays_are_capped_and_jittered():
    fn, _ = flaky(5)
    delays: list[float] = []
    with pytest.raises(RetryExhausted):
        retry(
            fn,
            attempts=4,
            base_delay=1.0,
            max_delay=1.5,
            sleep=delays.append,
            rng=random.Random(0),
        )
    assert len(delays) == 3
    assert all(0 <= d <= cap for d, cap in zip(delays, [1.0, 1.5, 1.5]))


def test_non_retryable_errors_propagate_immediately():
    def fn():
        raise KeyError("nope")

    with pytest.raises(KeyError):
        retry(fn, retry_on=(ConnectionError,), sleep=lambda _: None)
