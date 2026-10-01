from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.merchant_info import MerchantInfo
    from ..models.merchant_resource import MerchantResource


T = TypeVar("T", bound="X402MetadataResponse")


@_attrs_define
class X402MetadataResponse:
    """
    Example:
        {'merchant': {'name': 'IPFS Pay-to-Pin Gateway', 'description': 'Pay-per-request API that pins files to IPFS for
            365 days via Algorand microUSDC x402 payments.', 'icon':
            'https://gateway.pinata.cloud/ipfs/QmU9AgYdnWXHYqwsan75kJB8JPudY7kxfiguNHyn69BTiy', 'contact':
            'garretparker@gmail.com'}, 'resources': [{'path': '/api/v1/pin', 'price': 'dynamic (base $0.01 + $0.02/byte)',
            'description': 'Upload one file'}, {'path': '/api/v1/renew', 'price': 'dynamic (50% early renewal discount)',
            'description': 'Renew IPFS pin'}, {'path': '/api/v1/pin/{cid}', 'price': 'free', 'description': 'Check pin
            status'}]}

    Attributes:
        merchant (MerchantInfo | Unset):
        image (str | Unset): Logo URL.
        icon (str | Unset): Icon URL (alias of image).
        resources (list[MerchantResource] | Unset):
    """

    merchant: MerchantInfo | Unset = UNSET
    image: str | Unset = UNSET
    icon: str | Unset = UNSET
    resources: list[MerchantResource] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        merchant: dict[str, Any] | Unset = UNSET
        if not isinstance(self.merchant, Unset):
            merchant = self.merchant.to_dict()

        image = self.image

        icon = self.icon

        resources: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.resources, Unset):
            resources = []
            for resources_item_data in self.resources:
                resources_item = resources_item_data.to_dict()
                resources.append(resources_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if merchant is not UNSET:
            field_dict["merchant"] = merchant
        if image is not UNSET:
            field_dict["image"] = image
        if icon is not UNSET:
            field_dict["icon"] = icon
        if resources is not UNSET:
            field_dict["resources"] = resources

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.merchant_info import MerchantInfo  # noqa: PLC0415
        from ..models.merchant_resource import MerchantResource  # noqa: PLC0415

        d = dict(src_dict)
        _merchant = d.pop("merchant", UNSET)
        merchant: MerchantInfo | Unset
        if isinstance(_merchant, Unset):
            merchant = UNSET
        else:
            merchant = MerchantInfo.from_dict(_merchant)

        image = d.pop("image", UNSET)

        icon = d.pop("icon", UNSET)

        _resources = d.pop("resources", UNSET)
        resources: list[MerchantResource] | Unset = UNSET
        if _resources is not UNSET:
            resources = []
            for resources_item_data in _resources:
                resources_item = MerchantResource.from_dict(resources_item_data)

                resources.append(resources_item)

        x402_metadata_response = cls(
            merchant=merchant,
            image=image,
            icon=icon,
            resources=resources,
        )

        x402_metadata_response.additional_properties = d
        return x402_metadata_response

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
