type InputProps = {
  placeholder?: string;
  value?: string;
};

export function Input({ placeholder = "Search…", value }: InputProps) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      style={{
        width: "100%",
        border: "1px solid var(--acme-surface-2)",
        borderRadius: "var(--acme-radius-md)",
        padding: "10px 12px",
        fontSize: 16,
        color: "var(--acme-text)",
        backgroundColor: "var(--acme-surface-1)",
      }}
    />
  );
}
