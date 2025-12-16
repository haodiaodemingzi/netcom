import json
import os
import uuid
from typing import Set


class ActivationService:
    """激活码校验与令牌管理服务"""

    def __init__(self, code_path: str = None, token_path: str = None):
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.code_path = code_path or os.path.join(current_dir, "data", "activation_codes.json")
        self.token_path = token_path or os.path.join(current_dir, "data", "activation_tokens.json")
        self.valid_codes = self._load_codes()
        self.issued_tokens: Set[str] = self._load_tokens()

    def _load_codes(self) -> Set[str]:
        if not os.path.exists(self.code_path):
            return set()
        try:
            with open(self.code_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                codes = data.get("codes", [])
                return set(codes)
        except Exception as error:  # noqa: BLE001
            print(f"加载激活码配置失败: {error}")
            return set()

    def _load_tokens(self) -> Set[str]:
        if not os.path.exists(self.token_path):
            return set()
        try:
            with open(self.token_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                tokens = data.get("tokens", [])
                return set(tokens)
        except Exception as error:  # noqa: BLE001
            print(f"加载激活令牌失败: {error}")
            return set()

    def _persist_tokens(self) -> None:
        try:
            with open(self.token_path, "w", encoding="utf-8") as f:
                json.dump({"tokens": list(self.issued_tokens)}, f, ensure_ascii=False, indent=2)
        except Exception as error:  # noqa: BLE001
            print(f"保存激活令牌失败: {error}")

    def verify_code(self, code: str) -> str | None:
        if not code:
            return None
        if code not in self.valid_codes:
            return None
        token = uuid.uuid4().hex
        self.issued_tokens.add(token)
        self._persist_tokens()
        return token

    def is_token_valid(self, token: str) -> bool:
        if not token:
            return False
        return token in self.issued_tokens
