#!/bin/sh
set -eu

source_dir=/var/lib/ultrafoot/saves
backup_dir=/var/backups/ultrafoot
stamp="$(date -u +%Y%m%d-%H%M%S)"

install -d -o root -g root -m 0700 "$backup_dir"
tar -czf "$backup_dir/saves-$stamp.tar.gz" -C "$source_dir" .
find "$backup_dir" -type f -name 'saves-*.tar.gz' -mtime +14 -delete
