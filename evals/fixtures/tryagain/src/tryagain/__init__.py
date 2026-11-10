"""Retry a flaky call with capped exponential backoff and full jitter."""

import random
import time
from typing import Callable, TypeVar

__version__ = "1.3.0"

T = TypeVar("T")


class RetryExhausted(Exception):
    """Every attempt failed. `errors` holds each attempt's exception, in order."""

    def __init__(self, errors: list[BaseException]) -> None:
        super().__init__(
            f"all {len(errors)} attempts failed; last error: {errors[-1]!r}"
        )
        self.errors = errors


def retry(
    fn: Callable[[], T],
    *,
    attempts: int = 3,
    base_delay: float = 0.1,
    max_delay: float = 5.0,
    retry_on: tuple[type[BaseException], ...] = (Exception,),
    sleep: Callable[[float], None] = time.sleep,
    rng: random.Random | None = None,
) -> T:
    """Call `fn` until it returns, up to `attempts` times.

    Waits a random time in [0, min(max_delay, base_delay * 2**n)] between attempts.
    Exceptions not in `retry_on` propagate immediately. Raises RetryExhausted after
    the last failed attempt.
    """
    assert attempts >= 1, f"attempts must be >= 1, got {attempts}"
    assert base_delay >= 0, f"base_delay must be >= 0, got {base_delay}"
    rng = rng or random.Random()
    errors: list[BaseException] = []
    for n in range(attempts):
        try:
            return fn()
        except retry_on as e:
            errors.append(e)
            if n + 1 < attempts:
                sleep(rng.uniform(0, min(max_delay, base_delay * 2**n)))
    raise RetryExhausted(errors)
