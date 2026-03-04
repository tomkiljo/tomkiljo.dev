type LinkProps = {
  href: string;
  children?: string;
};

function Link({ href, children }: LinkProps) {
  return (
    <a fg="blue" href={href}>{children || href}</a>
  );
}

export default Link;