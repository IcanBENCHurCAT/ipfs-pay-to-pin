from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.agent_card_response import AgentCardResponse
from ...types import Response


def _get_kwargs() -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/.well-known/agent-card.json",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AgentCardResponse | None:
    if response.status_code == 200:
        response_200 = AgentCardResponse.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[AgentCardResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[AgentCardResponse]:
    """Agent Card specification (W3C Agent-Cards)

     Returns the W3C Agent Card specification for this gateway. Includes supported interfaces, skills,
    capabilities, and input/output modes. Cached for 1 hour.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AgentCardResponse]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> AgentCardResponse | None:
    """Agent Card specification (W3C Agent-Cards)

     Returns the W3C Agent Card specification for this gateway. Includes supported interfaces, skills,
    capabilities, and input/output modes. Cached for 1 hour.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AgentCardResponse
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[AgentCardResponse]:
    """Agent Card specification (W3C Agent-Cards)

     Returns the W3C Agent Card specification for this gateway. Includes supported interfaces, skills,
    capabilities, and input/output modes. Cached for 1 hour.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AgentCardResponse]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> AgentCardResponse | None:
    """Agent Card specification (W3C Agent-Cards)

     Returns the W3C Agent Card specification for this gateway. Includes supported interfaces, skills,
    capabilities, and input/output modes. Cached for 1 hour.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AgentCardResponse
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
