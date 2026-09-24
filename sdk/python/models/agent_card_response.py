from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.agent_card_response_capabilities import AgentCardResponseCapabilities
    from ..models.agent_card_response_supported_interfaces_item import AgentCardResponseSupportedInterfacesItem
    from ..models.skill import Skill


T = TypeVar("T", bound="AgentCardResponse")


@_attrs_define
class AgentCardResponse:
    """
    Attributes:
        name (str | Unset):
        description (str | Unset):
        version (str | Unset):
        capabilities (AgentCardResponseCapabilities | Unset):
        default_input_modes (list[str] | Unset):
        default_output_modes (list[str] | Unset):
        skills (list[Skill] | Unset):
        supported_interfaces (list[AgentCardResponseSupportedInterfacesItem] | Unset):
        icon (str | Unset):
        image (str | Unset):
    """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    version: str | Unset = UNSET
    capabilities: AgentCardResponseCapabilities | Unset = UNSET
    default_input_modes: list[str] | Unset = UNSET
    default_output_modes: list[str] | Unset = UNSET
    skills: list[Skill] | Unset = UNSET
    supported_interfaces: list[AgentCardResponseSupportedInterfacesItem] | Unset = UNSET
    icon: str | Unset = UNSET
    image: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        version = self.version

        capabilities: dict[str, Any] | Unset = UNSET
        if not isinstance(self.capabilities, Unset):
            capabilities = self.capabilities.to_dict()

        default_input_modes: list[str] | Unset = UNSET
        if not isinstance(self.default_input_modes, Unset):
            default_input_modes = self.default_input_modes

        default_output_modes: list[str] | Unset = UNSET
        if not isinstance(self.default_output_modes, Unset):
            default_output_modes = self.default_output_modes

        skills: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.skills, Unset):
            skills = []
            for skills_item_data in self.skills:
                skills_item = skills_item_data.to_dict()
                skills.append(skills_item)

        supported_interfaces: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.supported_interfaces, Unset):
            supported_interfaces = []
            for supported_interfaces_item_data in self.supported_interfaces:
                supported_interfaces_item = supported_interfaces_item_data.to_dict()
                supported_interfaces.append(supported_interfaces_item)

        icon = self.icon

        image = self.image

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if version is not UNSET:
            field_dict["version"] = version
        if capabilities is not UNSET:
            field_dict["capabilities"] = capabilities
        if default_input_modes is not UNSET:
            field_dict["defaultInputModes"] = default_input_modes
        if default_output_modes is not UNSET:
            field_dict["defaultOutputModes"] = default_output_modes
        if skills is not UNSET:
            field_dict["skills"] = skills
        if supported_interfaces is not UNSET:
            field_dict["supportedInterfaces"] = supported_interfaces
        if icon is not UNSET:
            field_dict["icon"] = icon
        if image is not UNSET:
            field_dict["image"] = image

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_card_response_capabilities import AgentCardResponseCapabilities  # noqa: PLC0415
        from ..models.agent_card_response_supported_interfaces_item import (
            AgentCardResponseSupportedInterfacesItem,  # noqa: PLC0415
        )
        from ..models.skill import Skill  # noqa: PLC0415

        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        version = d.pop("version", UNSET)

        _capabilities = d.pop("capabilities", UNSET)
        capabilities: AgentCardResponseCapabilities | Unset
        if isinstance(_capabilities, Unset):
            capabilities = UNSET
        else:
            capabilities = AgentCardResponseCapabilities.from_dict(_capabilities)

        default_input_modes = cast(list[str], d.pop("defaultInputModes", UNSET))

        default_output_modes = cast(list[str], d.pop("defaultOutputModes", UNSET))

        _skills = d.pop("skills", UNSET)
        skills: list[Skill] | Unset = UNSET
        if _skills is not UNSET:
            skills = []
            for skills_item_data in _skills:
                skills_item = Skill.from_dict(skills_item_data)

                skills.append(skills_item)

        _supported_interfaces = d.pop("supportedInterfaces", UNSET)
        supported_interfaces: list[AgentCardResponseSupportedInterfacesItem] | Unset = UNSET
        if _supported_interfaces is not UNSET:
            supported_interfaces = []
            for supported_interfaces_item_data in _supported_interfaces:
                supported_interfaces_item = AgentCardResponseSupportedInterfacesItem.from_dict(
                    supported_interfaces_item_data
                )

                supported_interfaces.append(supported_interfaces_item)

        icon = d.pop("icon", UNSET)

        image = d.pop("image", UNSET)

        agent_card_response = cls(
            name=name,
            description=description,
            version=version,
            capabilities=capabilities,
            default_input_modes=default_input_modes,
            default_output_modes=default_output_modes,
            skills=skills,
            supported_interfaces=supported_interfaces,
            icon=icon,
            image=image,
        )

        agent_card_response.additional_properties = d
        return agent_card_response

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
