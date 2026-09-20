from http import HTTPStatus
from typing import Any, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error_response import ErrorResponse
from ...models.renew_request import RenewRequest
from ...models.renew_response import RenewResponse
from ...types import Response


def _get_kwargs(
    *,
    body: RenewRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/renew",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | ErrorResponse | RenewResponse | None:
    if response.status_code == 200:
        response_200 = RenewResponse.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())

        return response_400

    if response.status_code == 402:
        response_402 = cast(Any, None)
        return response_402

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())

        return response_404

    if response.status_code == 410:
        response_410 = ErrorResponse.from_dict(response.json())

        return response_410

    if response.status_code == 500:
        response_500 = ErrorResponse.from_dict(response.json())

        return response_500

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Any | ErrorResponse | RenewResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: RenewRequest,
) -> Response[Any | ErrorResponse | RenewResponse]:
    """Renew an IPFS pin for another 365 days

     Renew an existing IPFS pin for another 365 days. Returns a 402 Payment Required challenge. A 50%
    early renewal discount applies if renewed before expiration. After 30 days grace period post-
    expiration, the pin is permanently removed and re-renewal is not possible (410 Gone).

    Args:
        body (RenewRequest):  Example: {'cid':
            'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'}.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | ErrorResponse | RenewResponse]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    body: RenewRequest,
) -> Any | ErrorResponse | RenewResponse | None:
    """Renew an IPFS pin for another 365 days

     Renew an existing IPFS pin for another 365 days. Returns a 402 Payment Required challenge. A 50%
    early renewal discount applies if renewed before expiration. After 30 days grace period post-
    expiration, the pin is permanently removed and re-renewal is not possible (410 Gone).

    Args:
        body (RenewRequest):  Example: {'cid':
            'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'}.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | ErrorResponse | RenewResponse
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: RenewRequest,
) -> Response[Any | ErrorResponse | RenewResponse]:
    """Renew an IPFS pin for another 365 days

     Renew an existing IPFS pin for another 365 days. Returns a 402 Payment Required challenge. A 50%
    early renewal discount applies if renewed before expiration. After 30 days grace period post-
    expiration, the pin is permanently removed and re-renewal is not possible (410 Gone).

    Args:
        body (RenewRequest):  Example: {'cid':
            'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'}.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | ErrorResponse | RenewResponse]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: RenewRequest,
) -> Any | ErrorResponse | RenewResponse | None:
    """Renew an IPFS pin for another 365 days

     Renew an existing IPFS pin for another 365 days. Returns a 402 Payment Required challenge. A 50%
    early renewal discount applies if renewed before expiration. After 30 days grace period post-
    expiration, the pin is permanently removed and re-renewal is not possible (410 Gone).

    Args:
        body (RenewRequest):  Example: {'cid':
            'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'}.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | ErrorResponse | RenewResponse
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
