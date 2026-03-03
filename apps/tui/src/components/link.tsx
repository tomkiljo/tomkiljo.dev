type LinkProps = {
  href: string;
  children?: string;
};

function Link({ href, children }: LinkProps) {
  return (
    <span fg="blue" style={{link: {url: href}}}>{children || href}</span>
  );
}

export default Link;