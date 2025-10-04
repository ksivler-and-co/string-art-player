## Code Parser

`code_parser.py` is a Python script for extracting and processing codes from a text file. Codes are expected to follow the format `[ABCD][0-9][0-9]?` (i.e., a letter A, B, C, or D followed by one or two digits). The script groups codes by sections, where each section starts with a number on its own line.

### Features
- Parses codes from a specified text file
- Groups codes by section
- Displays total codes and all codes in order
- Optionally saves extracted codes to a comma-separated text file

### Usage
Run the script from the command line:

```powershell
python code_parser.py [input_filename]
```

- If `input_filename` is not provided, the script defaults to `new 2 simple.txt`.
- After parsing, you can choose to save the results to a file (default: `extracted_codes.txt`).

### Example
Suppose your input file contains:

```
1
A12 B3 D7
2
C5 A1
```

The script will extract codes `A12`, `B3`, `D7`, `C5`, and `A1`, grouped by sections.

### Functions
- `parse_codes_from_file(filename)`: Parses and groups codes from the file.
- `print_results(results)`: Prints the total and all codes found.
- `save_codes_to_file(results, output_filename)`: Saves codes to a file.
- `main()`: Handles command-line arguments and user interaction.

### Requirements
- Python 3.x

### Error Handling
- If the input file is not found or cannot be read, an error message is displayed.

### License
MIT License (or specify your license here)
