#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <algorithm>

using namespace std;

// Split a CSV line into tokens
vector<string> split(const string& line, char delimiter = ',') {
    vector<string> tokens;
    string token;
    stringstream ss(line);

    while (getline(ss, token, delimiter)) {
        tokens.push_back(token);
    }

    return tokens;
}

// Read CSV file
vector<vector<string>> readCSV(const string& filename) {
    vector<vector<string>> data;
    ifstream file(filename);

    if (!file.is_open()) {
        cerr << "Error opening file\n";
        return data;
    }

    string line;
    while (getline(file, line)) {
        data.push_back(split(line));
    }

    return data;
}

// Write CSV file
void writeCSV(const string& filename, const vector<vector<string>>& data) {
    ofstream file(filename);

    for (const auto& row : data) {
        for (size_t i = 0; i < row.size(); i++) {
            file << row[i];
            if (i < row.size() - 1) file << ",";
        }
        file << "\n";
    }
}

// Sort CSV by column index
void sortCSV(vector<vector<string>>& data, int colIndex, bool hasHeader = true) {
    int start = hasHeader ? 1 : 0;

    sort(data.begin() + start, data.end(),
        [colIndex](const vector<string>& a, const vector<string>& b) {
            if (colIndex >= a.size() || colIndex >= b.size())
                return false;
            return a[colIndex] < b[colIndex]; // lexicographic
        });
}

int main() {
    string inputFile = "input.csv";
    string outputFile = "output.csv";
    int columnToSort = 1; // change this

    auto data = readCSV(inputFile);

    if (data.empty()) {
        cerr << "No data found\n";
        return 1;
    }

    sortCSV(data, columnToSort);
    writeCSV(outputFile, data);

    cout << "CSV sorted successfully.\n";
    return 0;
}