import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatar({
  firstName,
  lastName,
  avatarUrl,
  size,
  className,
}: {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={cn(className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={`${firstName} ${lastName}`} />}
      <AvatarFallback className="bg-primary text-primary-foreground">
        {initials(firstName || "U", lastName || "")}
      </AvatarFallback>
    </Avatar>
  );
}
