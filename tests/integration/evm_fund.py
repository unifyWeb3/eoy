"""Fund an ephemeral worker account with GEN via a plain EVM transfer.

Reads the payer key ONLY from the environment (never prints or stores it).
Uses a browser User-Agent because the hosted RPCs reject default Python UAs.
"""

import json
import os
import time
import urllib.request

UA = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
}


def _rpc(url, method, params):
    payload = json.dumps(
        {"jsonrpc": "2.0", "method": method, "params": params, "id": 1}
    ).encode()
    req = urllib.request.Request(url, data=payload, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.loads(r.read().decode())
    if out.get("error"):
        raise RuntimeError(f"RPC {method} failed: {out['error']}")
    return out["result"]


def fund_worker(worker_address, amount_wei, rpc_url, chain_id):
    """Send amount_wei GEN from the env payer key to worker_address. Returns tx hash."""
    from eth_account import Account

    payer_key = os.environ.get("GENLAYER_PRIVATE_KEY", "")
    if not payer_key:
        raise RuntimeError("GENLAYER_PRIVATE_KEY not set in environment")
    payer = Account.from_key(payer_key)

    nonce = int(_rpc(rpc_url, "eth_getTransactionCount", [payer.address, "latest"]), 16)
    gas_price = int(_rpc(rpc_url, "eth_gasPrice", []), 16)
    tx = {
        "to": worker_address,
        "value": amount_wei,
        "gas": 21000,
        "gasPrice": gas_price,
        "nonce": nonce,
        "chainId": chain_id,
    }
    signed = payer.sign_transaction(tx)
    tx_hash = _rpc(rpc_url, "eth_sendRawTransaction", [signed.raw_transaction.hex()])
    for _ in range(60):
        receipt = _rpc(rpc_url, "eth_getTransactionReceipt", [tx_hash])
        if receipt is not None:
            if int(receipt.get("status", "0x0"), 16) != 1:
                raise RuntimeError(f"fund tx failed: {receipt}")
            return tx_hash
        time.sleep(2)
    raise RuntimeError(f"fund tx not mined in time: {tx_hash}")


def get_balance_wei(rpc_url, address):
    return int(_rpc(rpc_url, "eth_getBalance", [address, "latest"]), 16)
