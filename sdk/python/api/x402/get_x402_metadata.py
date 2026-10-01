from http import HTTPStatus
from typing import Any, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.x402_metadata_response import X402MetadataResponse
from ...types import Response


def _get_kwargs() -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/.well-known/x402.json",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | X402MetadataResponse | None:
    if response.status_code == 200:
        response_200 = X402MetadataResponse.from_dict(response.json())

        return response_200

    if response.status_code == 404:
        response_404 = cast(Any, None)
        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Any | X402MetadataResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[Any | X402MetadataResponse]:
    """x402 merchant metadata

     Returns the x402 merchant metadata required by x402 resource server implementations to discover
    supported payment schemes, networks, and prices. Cached for 1 hour client-side and 24 hours at CDN
    edge.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | X402MetadataResponse]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> Any | X402MetadataResponse | None:
    """x402 merchant metadata

     Returns the x402 merchant metadata required by x402 resource server implementations to discover
    supported payment schemes, networks, and prices. Cached for 1 hour client-side and 24 hours at CDN
    edge.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | X402MetadataResponse
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[Any | X402MetadataResponse]:
    """x402 merchant metadata

     Returns the x402 merchant metadata required by x402 resource server implementations to discover
    supported payment schemes, networks, and prices. Cached for 1 hour client-side and 24 hours at CDN
    edge.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | X402MetadataResponse]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> Any | X402MetadataResponse | None:
    """x402 merchant metadata

     Returns the x402 merchant metadata required by x402 resource server implementations to discover
    supported payment schemes, networks, and prices. Cached for 1 hour client-side and 24 hours at CDN
    edge.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | X402MetadataResponse
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
