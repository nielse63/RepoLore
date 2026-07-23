import { formatGreeting } from "@/utils/format";

export interface HeaderProps {
  userName: string;
}

export function Header({ userName }: HeaderProps) {
  return <header>{formatGreeting(userName)}</header>;
}
