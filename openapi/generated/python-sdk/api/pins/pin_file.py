from http import HTTPStatus
from typing import Any, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error_pin_response import ErrorPinResponse
from ...models.error_response import ErrorResponse
from ...models.pin_request import PinRequest
from ...models.pin_response import PinResponse
from ...types import Response


def _get_kwargs(
    *,
    body: PinRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/pin",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | ErrorPinResponse | ErrorResponse | PinResponse | None:
    if response.status_code == 201:
        response_201 = PinResponse.from_dict(response.json())

        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())

        return response_400

    if response.status_code == 402:
        response_402 = cast(Any, None)
        return response_402

    if response.status_code == 413:
        response_413 = ErrorResponse.from_dict(response.json())

        return response_413

    if response.status_code == 500:
        response_500 = ErrorPinResponse.from_dict(response.json())

        return response_500

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Any | ErrorPinResponse | ErrorResponse | PinResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: PinRequest,
) -> Response[Any | ErrorPinResponse | ErrorResponse | PinResponse]:
    """Upload and pin a file to IPFS for 365 days

     Upload a Base64-encoded file via JSON payload. Returns a 402 Payment Required challenge with an x402
    payment header. Upon payment verification, pins the file to IPFS and returns the CID, gateway URL,
    and expiration data. Supports automatic refunds via x402 on processing failure.
    **Pricing:** $0.01 base (10,000 microUSDC) + $0.02/byte ($20/MB). A $2.50 Ethereum L1 gas floor
    surcharge applies if paying on Ethereum L1.

    Args:
        body (PinRequest):  Example: {'filename': 'document.pdf', 'data':
            'base64_encoded_file_data_here'}.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | ErrorPinResponse | ErrorResponse | PinResponse]
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
    body: PinRequest,
) -> Any | ErrorPinResponse | ErrorResponse | PinResponse | None:
    """Upload and pin a file to IPFS for 365 days

     Upload a Base64-encoded file via JSON payload. Returns a 402 Payment Required challenge with an x402
    payment header. Upon payment verification, pins the file to IPFS and returns the CID, gateway URL,
    and expiration data. Supports automatic refunds via x402 on processing failure.
    **Pricing:** $0.01 base (10,000 microUSDC) + $0.02/byte ($20/MB). A $2.50 Ethereum L1 gas floor
    surcharge applies if paying on Ethereum L1.

    Args:
        body (PinRequest):  Example: {'filename': 'document.pdf', 'data':
            'base64_encoded_file_data_here'}.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | ErrorPinResponse | ErrorResponse | PinResponse
    """

    return sync_detailed(
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: PinRequest,
) -> Response[Any | ErrorPinResponse | ErrorResponse | PinResponse]:
    """Upload and pin a file to IPFS for 365 days

     Upload a Base64-encoded file via JSON payload. Returns a 402 Payment Required challenge with an x402
    payment header. Upon payment verification, pins the file to IPFS and returns the CID, gateway URL,
    and expiration data. Supports automatic refunds via x402 on processing failure.
    **Pricing:** $0.01 base (10,000 microUSDC) + $0.02/byte ($20/MB). A $2.50 Ethereum L1 gas floor
    surcharge applies if paying on Ethereum L1.

    Args:
        body (PinRequest):  Example: {'filename': 'document.pdf', 'data':
            'base64_encoded_file_data_here'}.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | ErrorPinResponse | ErrorResponse | PinResponse]
    """

    kwargs = _get_kwargs(
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: PinRequest,
) -> Any | ErrorPinResponse | ErrorResponse | PinResponse | None:
    """Upload and pin a file to IPFS for 365 days

     Upload a Base64-encoded file via JSON payload. Returns a 402 Payment Required challenge with an x402
    payment header. Upon payment verification, pins the file to IPFS and returns the CID, gateway URL,
    and expiration data. Supports automatic refunds via x402 on processing failure.
    **Pricing:** $0.01 base (10,000 microUSDC) + $0.02/byte ($20/MB). A $2.50 Ethereum L1 gas floor
    surcharge applies if paying on Ethereum L1.

    Args:
        body (PinRequest):  Example: {'filename': 'document.pdf', 'data':
            'base64_encoded_file_data_here'}.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | ErrorPinResponse | ErrorResponse | PinResponse
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
        )
    ).parsed
