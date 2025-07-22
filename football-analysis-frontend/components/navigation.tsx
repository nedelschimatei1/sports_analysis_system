"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Video, Upload, LogOut, UserIcon } from "lucide-react"
import type { User } from "../types/auth"

interface NavigationProps {
  user: User
  currentPage: "upload" | "videos" | "profile"
  onPageChange: (page: "upload" | "videos" | "profile") => void
  onLogout: () => void
}

export function Navigation({ user, currentPage, onPageChange, onLogout }: NavigationProps) {
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-bold text-gray-900">Football Analyzer</h1>
          <div className="flex space-x-4">
            <Button
              variant={currentPage === "upload" ? "default" : "ghost"}
              onClick={() => onPageChange("upload")}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload Video
            </Button>
            <Button
              variant={currentPage === "videos" ? "default" : "ghost"}
              onClick={() => onPageChange("videos")}
              className="flex items-center gap-2"
            >
              <Video className="h-4 w-4" />
              My Videos
            </Button>
            <Button
              variant={currentPage === "profile" ? "default" : "ghost"}
              onClick={() => onPageChange("profile")}
              className="flex items-center gap-2"
            >
              <UserIcon className="h-4 w-4" />
              Profile
            </Button>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onLogout} className="flex items-center gap-2 text-red-600">
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
