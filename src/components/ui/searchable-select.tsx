"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "./input"

export interface SearchableSelectItem {
  id: string
  name: string
  [key: string]: any
}

interface SearchableSelectProps {
  items: SearchableSelectItem[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  name?: string
  label?: string
  emptyMessage?: string
}

const SearchableSelect = React.forwardRef<HTMLDivElement, SearchableSelectProps>(
  (
    {
      items,
      value,
      onValueChange,
      placeholder = "اختر عنصراً",
      searchPlaceholder = "ابحث...",
      disabled = false,
      name,
      label,
      emptyMessage = "لا توجد نتائج",
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [searchTerm, setSearchTerm] = React.useState("")
    const containerRef = React.useRef<HTMLDivElement>(null)
    const searchInputRef = React.useRef<HTMLInputElement>(null)

    // Filter items based on search term
    const filteredItems = React.useMemo(() => {
      if (!searchTerm) return items
      return items.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }, [items, searchTerm])

    // Get selected item
    const selectedItem = items.find((item) => item.id === value)

    // Handle item selection
    const handleSelect = (itemId: string) => {
      onValueChange(itemId)
      setIsOpen(false)
      setSearchTerm("")
    }

    // Handle clear selection
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      onValueChange("")
      setSearchTerm("")
    }

    // Focus search input when dropdown opens
    React.useEffect(() => {
      if (isOpen && searchInputRef.current) {
        searchInputRef.current.focus()
      }
    }, [isOpen])

    // Close dropdown when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false)
        }
      }

      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
      <div ref={ref} className="w-full">
        <div
          ref={containerRef}
          className="relative"
        >
          {/* Trigger Button */}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              isOpen && "ring-1 ring-ring"
            )}
          >
            <span className={selectedItem ? "text-foreground" : "text-muted-foreground"}>
              {selectedItem?.name || placeholder}
            </span>
            <div className="flex items-center gap-1 ml-2">
              {selectedItem && !disabled && (
                <X
                  className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={handleClear}
                />
              )}
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>

          {/* Dropdown Menu */}
          {isOpen && !disabled && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-input rounded-md bg-popover shadow-md">
              {/* Search Input */}
              <div className="border-b p-2">
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-sm text-right"
                  dir="rtl"
                />
              </div>

              {/* Items List */}
              <div className="max-h-64 overflow-y-auto">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={cn(
                        "w-full px-3 py-2 text-right text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:bg-accent focus:text-accent-foreground",
                        value === item.id && "bg-accent text-accent-foreground font-medium"
                      )}
                    >
                      {item.name}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
)

SearchableSelect.displayName = "SearchableSelect"

export { SearchableSelect }
