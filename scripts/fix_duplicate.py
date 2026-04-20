#!/usr/bin/env python3
"""
Script to remove duplicate /api/dashboard/running-meetings endpoint
"""

with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and remove lines 657-677 (duplicate endpoint)
# Keep lines before 657 and after 677
output_lines = lines[:656] + lines[677:]

with open('server.js', 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print("Duplicate endpoint removed successfully!")
print("Lines 657-677 were deleted (duplicate /api/dashboard/running-meetings)")
