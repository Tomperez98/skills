"""User-registration workflow with a four-variant error union and retry helper.

The workflow is already structured to be testable: dependencies are injected,
errors are explicit values. It just has no tests.
"""

import time
from dataclasses import dataclass
from typing import Any, Callable, Union


@dataclass
class InvalidCreateUser:
    reason: str


@dataclass
class EmailTaken:
    email: str


@dataclass
class UserStoreUnavailable:
    cause: str


@dataclass
class PublishFailed:
    cause: str


RegisterUserError = Union[
    InvalidCreateUser, EmailTaken, UserStoreUnavailable, PublishFailed
]


@dataclass
class CreateUser:
    name: str
    email: str


@dataclass
class User:
    id: int
    name: str
    email: str


def parse_create_user(raw: str) -> Union[CreateUser, InvalidCreateUser]:
    """Boundary parser: raw -> domain value. Absorbs all shape-checking."""
    parts = raw.split("|")
    if len(parts) != 2 or not parts[0].strip() or "@" not in parts[1]:
        return InvalidCreateUser(reason=f"bad payload: {raw!r}")
    return CreateUser(name=parts[0].strip(), email=parts[1].strip())


def ensure_email_available(email: str, existing: set) -> Union[None, EmailTaken]:
    if email in existing:
        return EmailTaken(email=email)
    return None


def insert_user(command: CreateUser, store: Any) -> Union[User, UserStoreUnavailable]:
    try:
        return store.insert(command)
    except Exception as exc:
        return UserStoreUnavailable(cause=str(exc))


def publish_user_registered(
    user: User, publisher: Callable[[User], None]
) -> Union[None, PublishFailed]:
    try:
        publisher(user)
        return None
    except Exception as exc:
        return PublishFailed(cause=str(exc))


def register_user(raw: str, existing: set, store: Any, publisher: Callable[[User], None]):
    """Composed workflow: every expected failure is in the return union;
    a failed step short-circuits the rest."""
    command = parse_create_user(raw)
    if isinstance(command, InvalidCreateUser):
        return command
    taken = ensure_email_available(command.email, existing)
    if isinstance(taken, EmailTaken):
        return taken
    user = insert_user(command, store)
    if isinstance(user, UserStoreUnavailable):
        return user
    pub = publish_user_registered(user, publisher)
    if isinstance(pub, PublishFailed):
        return pub
    return user


def try_with_retry(
    operation: Callable[[int], Any], retries: int, delay: float
):
    """Run operation(attempt) with attempt = 1, 2, ...; retry up to `retries`
    times on UserStoreUnavailable, sleeping `delay` between attempts. Returns
    the first non-UserStoreUnavailable result, else the last failure."""
    last = None
    for attempt in range(1, retries + 2):
        last = operation(attempt)
        if not isinstance(last, UserStoreUnavailable):
            return last
        if attempt <= retries:
            time.sleep(delay)
    return last
