"use client";

import { ChevronDown, FileUp, FolderPlus, FolderUp, Plus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpload } from "@/components/upload/upload-provider";
import { useAppDispatch } from "@/store";
import { newFolderOpenChanged } from "@/store/slices/app";

export function FileActions() {
  const { pick } = useUpload();
  const dispatch = useAppDispatch();
  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="lg" />}>
          <Plus />
          New
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => dispatch(newFolderOpenChanged(true))}>
              <FolderPlus />
              New folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pick()}>
              <FileUp />
              Upload files
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pick(true)}>
              <FolderUp />
              Upload folder
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="lg" onClick={() => pick()}>
        <Upload data-icon="inline-start" />
        Upload files
      </Button>
    </div>
  );
}
