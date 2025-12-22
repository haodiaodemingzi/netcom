bool isBlank(String? value) {
  if (value == null) {
    return true;
  }
  return value.trim().isEmpty;
}

bool isNotBlank(String? value) {
  return !isBlank(value);
}
