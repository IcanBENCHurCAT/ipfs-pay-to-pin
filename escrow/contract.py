from algopy import ARC4Contract, GlobalState, UInt64, Txn, Global, Account, arc4, itxn

class PayToPinEscrow(ARC4Contract):
    """
    Algorand Smart Contract for IPFS Pay-to-Pin Gateway management.
    Handles pricing rates, registry of authorized gateway operators, and treasury payouts.
    """
    def __init__(self) -> None:
        self.owner = GlobalState(Account, key="owner")
        self.base_price = GlobalState(UInt64, key="base_price")
        self.byte_price = GlobalState(UInt64, key="byte_price")

    @arc4.abimethod(create="require")
    def create(self) -> None:
        self.owner.value = Txn.sender
        self.base_price.value = UInt64(1000)  # base microALGO price
        self.byte_price.value = UInt64(1)     # microALGOs per byte

    @arc4.abimethod
    def update_pricing(self, new_base: UInt64, new_byte_price: UInt64) -> None:
        """
        Allows contract owner to update storage rates.
        """
        assert Txn.sender == self.owner.value, "Only owner can update pricing"
        assert Txn.rekey_to == Global.zero_address, "Transaction must not rekey the account"
        self.base_price.value = new_base
        self.byte_price.value = new_byte_price

    @arc4.abimethod
    def withdraw_fees(self, amount: UInt64, receiver: Account) -> None:
        """
        Allows contract owner to withdraw accumulated service fees to a treasury account.
        """
        assert Txn.sender == self.owner.value, "Only owner can withdraw fees"
        assert Txn.rekey_to == Global.zero_address, "Transaction must not rekey the account"
        
        # Implement fee withdrawal inner transaction logic here.
        itxn.Payment(
            amount=amount,
            receiver=receiver,
            fee=0,
        ).submit()
