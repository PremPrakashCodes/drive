// A titled group of keyboard shortcuts, each an [action, keys] pair.
export type ShortcutGroup = {
  title: string;
  description: string;
  items: [string, string[]][];
};

// Label, placeholder and hint for one storage connection field.
export type StorageFieldCopy = { label: string; placeholder: string; hint: string };

// A storage provider's wording for the connect wizard's fields.
export type StorageCredentialCopy = {
  access: StorageFieldCopy;
  secret: StorageFieldCopy;
  bucket: StorageFieldCopy;
  region: StorageFieldCopy;
};
