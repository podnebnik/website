#!/bin/bash
set -e

echo "🧪 Performance Testing: JavaScript vs TypeScript+JavaScript Build"
echo "=============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to measure build time
measure_build() {
    local build_type="$1"
    echo -e "\n${BLUE}📊 Testing $build_type build...${NC}"
    
    # Clean build cache
    echo "🧹 Cleaning build cache..."
    rm -rf _site/ public/ code/bin/ code/obj/ node_modules/.cache/
    
    # Time the build
    echo "⏱️  Starting build timing..."
    local start_time=$(date +%s.%3N)
    
    if [ "$build_type" = "production" ]; then
        yarn build > /dev/null 2>&1
    else
        timeout 20s yarn start > /dev/null 2>&1 || true
    fi
    
    local end_time=$(date +%s.%3N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    echo -e "✅ ${GREEN}$build_type build completed in: ${duration}s${NC}"
    
    # Get build artifact sizes
    if [ -d "_site" ]; then
        local site_size=$(du -sh _site/ | cut -f1)
        echo -e "📦 Site size: $site_size"
    fi
    
    if [ -d "code/bin" ]; then
        local code_size=$(du -sh code/bin/ | cut -f1)
        echo -e "📦 Compiled code size: $code_size"
    fi
    
    echo "$duration"
}

# Function to create temporary JS-only setup for comparison
setup_js_only() {
    echo -e "\n${YELLOW}🔄 Setting up JavaScript-only comparison...${NC}"
    
    # Backup TypeScript files
    mkdir -p .temp-backup
    find code/ali-je-vroce -name "*.ts" -o -name "*.tsx" | while read file; do
        cp "$file" ".temp-backup/$(basename "$file")"
        # Convert to .js/.jsx for comparison
        js_file=$(echo "$file" | sed 's/\.ts$/.js/' | sed 's/\.tsx$/.jsx/')
        mv "$file" "$js_file"
    done
    
    echo "✅ Created JavaScript-only setup"
}

# Function to restore TypeScript setup
restore_ts_setup() {
    echo -e "\n${YELLOW}🔄 Restoring TypeScript setup...${NC}"
    
    # Restore TypeScript files
    if [ -d ".temp-backup" ]; then
        find code/ali-je-vroce -name "*.js" -o -name "*.jsx" | while read file; do
            # Skip files that were originally .jsx
            if [[ "$file" == *"vroce.jsx" ]] || [[ "$file" == *".fs.jsx" ]]; then
                continue
            fi
            
            # Restore .ts/.tsx files
            ts_file=$(echo "$file" | sed 's/\.js$/.ts/' | sed 's/\.jsx$/.tsx/')
            backup_file=".temp-backup/$(basename "$ts_file")"
            
            if [ -f "$backup_file" ]; then
                mv "$backup_file" "$ts_file"
                rm "$file"
            fi
        done
        
        rm -rf .temp-backup
    fi
    
    echo "✅ Restored TypeScript setup"
}

# Performance test function
run_performance_tests() {
    echo -e "\n${BLUE}🚀 Running Performance Comparison Tests${NC}"
    echo "========================================"
    
    # Test 1: TypeScript+JavaScript build
    echo -e "\n${YELLOW}Test 1: TypeScript + JavaScript Mixed Build${NC}"
    ts_time=$(measure_build "production")
    
    # Test 2: JavaScript-only build (for comparison)
    setup_js_only
    echo -e "\n${YELLOW}Test 2: JavaScript-only Build${NC}"
    js_time=$(measure_build "production")
    restore_ts_setup
    
    # Test 3: Development server startup comparison
    echo -e "\n${YELLOW}Test 3: Development Server Startup${NC}"
    dev_time=$(measure_build "development")
    
    # Calculate performance comparison
    echo -e "\n${GREEN}📊 PERFORMANCE RESULTS${NC}"
    echo "========================"
    echo -e "TypeScript+JS build: ${ts_time}s"
    echo -e "JavaScript-only build: ${js_time}s"
    echo -e "Development startup: ${dev_time}s"
    
    # Calculate percentage difference
    if command -v bc >/dev/null 2>&1; then
        local diff=$(echo "scale=2; (($ts_time - $js_time) / $js_time) * 100" | bc)
        if (( $(echo "$diff < 10" | bc -l) )); then
            echo -e "\n✅ ${GREEN}PASS: TypeScript build overhead is acceptable (<10%)${NC}"
            echo -e "📈 Performance impact: ${diff}%"
        else
            echo -e "\n⚠️  ${YELLOW}WARNING: TypeScript build overhead is significant (>10%)${NC}"
            echo -e "📈 Performance impact: ${diff}%"
        fi
    fi
}

# Check dependencies
check_dependencies() {
    echo -e "${BLUE}🔍 Checking dependencies...${NC}"
    
    if ! command -v bc >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  bc calculator not found, installing for performance calculations...${NC}"
        # Install bc if possible (on macOS)
        if command -v brew >/dev/null 2>&1; then
            brew install bc
        else
            echo -e "${RED}❌ Cannot install bc calculator. Performance comparison will be limited.${NC}"
        fi
    fi
    
    if ! command -v timeout >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  timeout command not found, using alternative approach...${NC}"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}🏃 Starting TypeScript Integration Performance Tests${NC}"
    
    # Ensure we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "eleventy.config.mjs" ]; then
        echo -e "${RED}❌ Error: Must be run from the project root directory${NC}"
        exit 1
    fi
    
    check_dependencies
    run_performance_tests
    
    echo -e "\n${GREEN}✅ Performance testing completed!${NC}"
}

# Run the main function
main
