#!/bin/bash

# Quick launcher for database utility scripts
# All scripts are located in packages/shared/util-scripts/

SCRIPTS_DIR="packages/shared/util-scripts"

show_menu() {
  echo ""
  echo "🗄️  CX-DAM Database Utility Scripts"
  echo "===================================="
  echo ""
  echo "1) 📊 View database statistics"
  echo "2) 🗑️  Clean orphaned assets (Stage > 1 hour)"
  echo "3) 🧹 Clean ALL data (⚠️  DESTRUCTIVE)"
  echo "4) 📖 View README documentation"
  echo "5) 🚪 Exit"
  echo ""
  read -p "Select an option (1-5): " choice
  echo ""
}

while true; do
  show_menu

  case $choice in
    1)
      echo "Running: view-data-stats.sh"
      echo "─────────────────────────────────────"
      ./$SCRIPTS_DIR/view-data-stats.sh
      ;;
    2)
      echo "Running: clean-orphaned-assets.sh"
      echo "─────────────────────────────────────"
      ./$SCRIPTS_DIR/clean-orphaned-assets.sh
      ;;
    3)
      echo "Running: clean-all-data.sh"
      echo "─────────────────────────────────────"
      ./$SCRIPTS_DIR/clean-all-data.sh
      ;;
    4)
      echo "Showing: README.md"
      echo "─────────────────────────────────────"
      cat $SCRIPTS_DIR/README.md
      echo ""
      read -p "Press Enter to continue..."
      ;;
    5)
      echo "👋 Goodbye!"
      exit 0
      ;;
    *)
      echo "❌ Invalid option. Please select 1-5."
      ;;
  esac
done
