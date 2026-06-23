import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";

import { Button } from "@paybuddy/ui/components/button";
import { cn } from "@paybuddy/ui/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      role="navigation"
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationButtonProps = React.ComponentProps<typeof Button> & {
  text?: string;
};

function PaginationPrevious({
  className,
  text = "Previous",
  ...props
}: PaginationButtonProps) {
  return (
    <Button
      aria-label="Go to previous page"
      className={cn("pl-1.5", className)}
      size="default"
      variant="ghost"
      {...props}
    >
      <ChevronLeftIcon className="cn-rtl-flip" data-icon="inline-start" />
      <span className="hidden sm:block">{text}</span>
    </Button>
  );
}

function PaginationNext({ className, text = "Next", ...props }: PaginationButtonProps) {
  return (
    <Button
      aria-label="Go to next page"
      className={cn("pr-1.5", className)}
      size="default"
      variant="ghost"
      {...props}
    >
      <span className="hidden sm:block">{text}</span>
      <ChevronRightIcon className="cn-rtl-flip" data-icon="inline-end" />
    </Button>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-8 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
};
