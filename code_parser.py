import re
import sys

def parse_codes_from_file(filename):
    """
    Parse codes with format [ABCD][0-9][0-9]? from a file.
    
    Args:
        filename (str): Path to the file to parse
    
    Returns:
        list: List of found codes grouped by section
    """
    # Regular expression pattern for codes: A, B, C, or D followed by 1-2 digits
    code_pattern = r'[ABCD]\d{1,2}'
    
    results = []
    
    try:
        with open(filename, 'r') as file:
            content = file.read()
            
        # Split content into sections (each section starts with a number on its own line)
        sections = re.split(r'\n(\d+)\n', content)
        
        section_number = 0
        for i in range(len(sections)):
            section_data = sections[i].strip()
            
            # Skip empty sections and section number lines
            if not section_data or section_data.isdigit():
                continue
                
            # Find all codes in this section
            codes = re.findall(code_pattern, section_data)
            
            if codes:
                section_number += 1
                results.append({
                    'section': section_number,
                    'codes': codes,
                    'code_count': len(codes)
                })
                
    except FileNotFoundError:
        print(f"Error: File '{filename}' not found.")
        return []
    except Exception as e:
        print(f"Error reading file: {e}")
        return []
    
    return results

def print_results(results):
    """Print the parsing results in a formatted way."""
    if not results:
        print("No codes found.")
        return
    
    # Collect all codes from all sections in order
    all_codes = []
    for result in results:
        all_codes.extend(result['codes'])
    
    print("=" * 50)
    print("CODE PARSING RESULTS")
    print("=" * 50)
    print(f"Total codes found: {len(all_codes)}")
    print("\nAll codes in order:")
    print(", ".join(all_codes))

def save_codes_to_file(results, output_filename):
    """Save extracted codes to a text file as one comma-separated row."""
    try:
        # Collect all codes from all sections in order
        all_codes = []
        for result in results:
            all_codes.extend(result['codes'])
        
        with open(output_filename, 'w') as file:
            file.write(", ".join(all_codes))
                
        print(f"Results saved to '{output_filename}'")
    except Exception as e:
        print(f"Error saving to file: {e}")

def main():
    """Main function to run the script."""
    # Default filename - can be changed via command line argument
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = "new 2 simple.txt"  # Default filename based on your document
    
    print(f"Parsing codes from file: {filename}")
    
    # Parse the file
    results = parse_codes_from_file(filename)
    
    # Display results
    print_results(results)
    
    # Optionally save results to file
    if results:
        save_choice = input("\nSave results to file? (y/n): ").lower().strip()
        if save_choice == 'y':
            output_filename = input("Enter output filename (default: extracted_codes.txt): ").strip()
            if not output_filename:
                output_filename = "extracted_codes.txt"
            save_codes_to_file(results, output_filename)

if __name__ == "__main__":
    main()
