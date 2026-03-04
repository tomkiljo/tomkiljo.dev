type NavbarProps = {
  children?: React.ReactNode;
};

function Navbar({ children }: NavbarProps) {
  return (
    <box flexDirection="row" justifyContent="space-between">
      <box flexDirection="row" gap={2}>
        <text fg="white">esc: <span fg="gray">home</span></text>
        <text fg="white">ctrl+a: <span fg="gray">ask</span></text>
        <text fg="white">ctrl+d: <span fg="gray">journal</span></text>
        <text fg="white">ctrl+q: <span fg="gray">quit</span></text>
      </box>
      <box flexDirection="row" gap={2}>
        {children}
      </box>
    </box>
  );
};

export default Navbar;