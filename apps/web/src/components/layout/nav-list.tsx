"use client";

import { cloneElement, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavItem } from "@/lib/nav-config";

function sectionRoot(item: NavItem) {
  if (!item.children) return item.href;
  const parts = item.href.split("/");
  return parts.slice(0, 3).join("/");
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavList({
  items,
  onNavigate,
  collapsed,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(items.filter((item) => item.children && isActive(pathname, sectionRoot(item))).map((i) => i.href)),
  );

  useEffect(() => {
    const active = items.find((item) => item.children && isActive(pathname, sectionRoot(item)));
    setOpenSections(active ? new Set([active.href]) : new Set());
  }, [pathname, items]);

  function toggleSection(href: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, sectionRoot(item));

        if (!item.children) {
          const link = (
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );

          if (!collapsed) return cloneElement(link, { key: item.href });

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        if (collapsed) {
          return (
            <DropdownMenu key={item.href}>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={item.label}
                    className={cn(
                      "flex items-center justify-center rounded-md px-0 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  />
                }
              >
                <Icon className="size-4 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {item.children.map((child) => (
                    <DropdownMenuItem
                      key={child.href}
                      render={<Link href={child.href} onClick={onNavigate} />}
                    >
                      {child.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        const open = openSections.has(item.href);

        return (
          <div key={item.href} className="flex flex-col">
            <div
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Link href={item.href} onClick={onNavigate} className="flex flex-1 items-center gap-3 px-3 py-2">
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
              <button
                type="button"
                onClick={() => toggleSection(item.href)}
                aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
                aria-expanded={open}
                className="flex shrink-0 items-center justify-center px-2.5 py-2"
              >
                <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
              </button>
            </div>
            {open && (
              <div className="mt-1 flex flex-col gap-1 border-l border-sidebar-border pl-3">
                {item.children.map((child) => {
                  const childActive = isActive(pathname, child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm transition-colors",
                        childActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
