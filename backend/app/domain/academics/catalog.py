from __future__ import annotations

from .constants import STUDENTS_PER_DEPARTMENT

DEPARTMENTS = [
    {
        "code": "CSE",
        "name": "Computer Science and Engineering",
        "short_name": "Computer Science",
        "hod": "Dr. Ananya Varma",
        "established_year": 1998,
        "intake": 120,
    },
    {
        "code": "ECE",
        "name": "Electronics and Communication Engineering",
        "short_name": "Electronics",
        "hod": "Dr. Rohan Iyer",
        "established_year": 2001,
        "intake": 120,
    },
    {
        "code": "EEE",
        "name": "Electrical and Electronics Engineering",
        "short_name": "Electrical",
        "hod": "Dr. Meera Kulkarni",
        "established_year": 2001,
        "intake": 60,
    },
    {
        "code": "MECH",
        "name": "Mechanical Engineering",
        "short_name": "Mechanical",
        "hod": "Dr. Arvind Rao",
        "established_year": 1998,
        "intake": 120,
    },
    {
        "code": "CIVIL",
        "name": "Civil Engineering",
        "short_name": "Civil",
        "hod": "Dr. Kavita Menon",
        "established_year": 2005,
        "intake": 60,
    },
]

SUBJECT_CATALOG = {
    "CSE": {
        1: [
            ("CS101", "Engineering Mathematics I", 4, 0),
            ("CS102", "Programming Fundamentals", 4, -1),
            ("CS103", "Digital Logic Design", 3, 0),
            ("CS104", "Engineering Physics", 3, 1),
            ("CS105", "Programming Laboratory", 2, -2),
        ],
        2: [
            ("CS201", "Discrete Mathematics", 4, 0),
            ("CS202", "Data Structures", 4, -1),
            ("CS203", "Computer Organization", 3, 0),
            ("CS204", "Object-Oriented Programming", 3, -1),
            ("CS205", "Data Structures Laboratory", 2, -2),
        ],
        3: [
            ("CS301", "Compiler Design", 4, 0),
            ("CS302", "Computer Networks", 4, 1),
            ("CS303", "Operating Systems", 4, 0),
            ("CS304", "Database Management Systems", 3, -1),
            ("CS305", "Software Engineering Laboratory", 2, -2),
        ],
        4: [
            ("CS401", "Machine Learning", 4, 1),
            ("CS402", "Distributed Systems", 3, 0),
            ("CS403", "Cloud Computing", 3, -1),
            ("CS404", "Information Security", 4, 1),
            ("CS405", "Project Laboratory", 2, -2),
        ],
    },
    "ECE": {
        1: [
            ("EC101", "Engineering Mathematics I", 4, 0),
            ("EC102", "Basic Electronics", 4, -1),
            ("EC103", "Circuit Theory", 3, 0),
            ("EC104", "Engineering Physics", 3, 1),
            ("EC105", "Circuits Laboratory", 2, -2),
        ],
        2: [
            ("EC201", "Signals and Systems", 4, 1),
            ("EC202", "Digital Electronics", 4, 0),
            ("EC203", "Network Analysis", 3, 0),
            ("EC204", "Electronic Devices", 3, -1),
            ("EC205", "Electronics Laboratory", 2, -2),
        ],
        3: [
            ("EC301", "Digital Signal Processing", 4, 1),
            ("EC302", "Microcontrollers and Embedded Systems", 4, 0),
            ("EC303", "Analog Communication", 3, 0),
            ("EC304", "Control Systems", 3, 1),
            ("EC305", "VLSI Design", 3, -1),
        ],
        4: [
            ("EC401", "Wireless Communication", 4, 1),
            ("EC402", "Digital Image Processing", 3, 0),
            ("EC403", "Antenna and Wave Propagation", 3, 1),
            ("EC404", "Internet of Things", 3, -1),
            ("EC405", "Embedded Systems Laboratory", 2, -2),
        ],
    },
    "EEE": {
        1: [
            ("EE101", "Engineering Mathematics I", 4, 0),
            ("EE102", "Basic Electrical Engineering", 4, -1),
            ("EE103", "Engineering Mechanics", 3, 0),
            ("EE104", "Engineering Physics", 3, 1),
            ("EE105", "Electrical Laboratory", 2, -2),
        ],
        2: [
            ("EE201", "Circuit Analysis", 4, 0),
            ("EE202", "Electromagnetic Fields", 4, 1),
            ("EE203", "Electrical Machines I", 4, 0),
            ("EE204", "Analog Electronics", 3, -1),
            ("EE205", "Machines Laboratory", 2, -2),
        ],
        3: [
            ("EE301", "Power Systems I", 4, 1),
            ("EE302", "Electrical Machines II", 4, 1),
            ("EE303", "Control Systems", 3, 0),
            ("EE304", "Power Electronics", 3, 0),
            ("EE305", "Measurements Laboratory", 2, -2),
        ],
        4: [
            ("EE401", "Power Systems II", 4, 1),
            ("EE402", "Renewable Energy Systems", 3, -1),
            ("EE403", "Electric Drives", 3, 0),
            ("EE404", "High Voltage Engineering", 3, 1),
            ("EE405", "Simulation Laboratory", 2, -2),
        ],
    },
    "MECH": {
        1: [
            ("ME101", "Engineering Mathematics I", 4, 0),
            ("ME102", "Engineering Mechanics", 4, -1),
            ("ME103", "Engineering Graphics", 3, 0),
            ("ME104", "Engineering Physics", 3, 1),
            ("ME105", "Workshop Practice", 2, -2),
        ],
        2: [
            ("ME201", "Thermodynamics", 4, 0),
            ("ME202", "Strength of Materials", 4, 1),
            ("ME203", "Fluid Mechanics I", 3, 0),
            ("ME204", "Manufacturing Processes", 3, -1),
            ("ME205", "Materials Laboratory", 2, -2),
        ],
        3: [
            ("ME301", "Design of Machine Elements", 4, 1),
            ("ME302", "Fluid Mechanics II", 4, 0),
            ("ME303", "Heat Transfer", 4, 1),
            ("ME304", "Manufacturing Technology", 3, -1),
            ("ME305", "Thermal Engineering Laboratory", 2, -2),
        ],
        4: [
            ("ME401", "Automobile Engineering", 3, 0),
            ("ME402", "Refrigeration and Air Conditioning", 4, 1),
            ("ME403", "Computer Aided Design", 3, -1),
            ("ME404", "Industrial Engineering", 3, 0),
            ("ME405", "Mechatronics Laboratory", 2, -2),
        ],
    },
    "CIVIL": {
        1: [
            ("CE101", "Engineering Mathematics I", 4, 0),
            ("CE102", "Engineering Mechanics", 4, -1),
            ("CE103", "Engineering Graphics", 3, 0),
            ("CE104", "Engineering Physics", 3, 1),
            ("CE105", "Surveying Laboratory", 2, -2),
        ],
        2: [
            ("CE201", "Strength of Materials", 4, 0),
            ("CE202", "Fluid Mechanics", 4, 1),
            ("CE203", "Surveying", 3, 0),
            ("CE204", "Building Materials", 3, -1),
            ("CE205", "Materials Laboratory", 2, -2),
        ],
        3: [
            ("CE301", "Structural Analysis", 4, 1),
            ("CE302", "Geotechnical Engineering", 4, 0),
            ("CE303", "Transportation Engineering", 3, -1),
            ("CE304", "Environmental Engineering", 3, 0),
            ("CE305", "Concrete Technology Laboratory", 2, -2),
        ],
        4: [
            ("CE401", "Design of Steel Structures", 4, 1),
            ("CE402", "Water Resources Engineering", 4, 0),
            ("CE403", "Construction Management", 3, -1),
            ("CE404", "Earthquake Engineering", 3, 1),
            ("CE405", "Surveying Laboratory II", 2, -2),
        ],
    },
}

FIRST_NAMES = [
    "Aarav", "Aditi", "Advait", "Aisha", "Akash", "Ananya", "Arjun", "Avni",
    "Bhavya", "Chirag", "Devika", "Dhruv", "Esha", "Farhan", "Gauri", "Harish",
    "Isha", "Jatin", "Kabir", "Kavya", "Kiran", "Lakshmi", "Manav", "Maya",
    "Naveen", "Neha", "Nikhil", "Nisha", "Omkar", "Pooja", "Pranav", "Priya",
    "Rahul", "Riya", "Rohit", "Saanvi", "Sahil", "Sanjana", "Shreya", "Siddharth",
    "Sneha", "Tanvi", "Tarun", "Trisha", "Uday", "Vaishnavi", "Varun", "Vedant",
    "Vidya", "Vivek",
]

MIDDLE_INITIALS = ["A.", "B.", "D.", "K.", "M.", "N.", "P.", "R.", "S.", "V."]

LAST_NAMES = [
    "Sharma", "Verma", "Iyer", "Nair", "Menon", "Rao", "Reddy", "Naidu",
    "Gupta", "Agarwal", "Mishra", "Pandey", "Joshi", "Kulkarni", "Deshpande",
    "Patil", "Desai", "Shah", "Mehta", "Kapoor", "Malhotra", "Chopra", "Bhat",
    "Hegde", "Shetty", "Pillai", "Das", "Bose", "Ghosh", "Dutta", "Banerjee",
    "Roy", "Yadav", "Singh", "Chauhan", "Rathore", "Saxena", "Trivedi", "Varma",
    "Kamath",
]


def subject_documents() -> list[dict]:
    documents = []
    for department_code, semesters in SUBJECT_CATALOG.items():
        for semester, subjects in semesters.items():
            for code, name, credits, difficulty in subjects:
                documents.append(
                    {
                        "_id": code,
                        "code": code,
                        "name": name,
                        "department_code": department_code,
                        "semester": semester,
                        "credits": credits,
                        "internal_max": 30,
                        "external_max": 70,
                        "pass_marks": 40,
                        "difficulty": difficulty,
                    }
                )
    return documents


def department_documents() -> list[dict]:
    return [
        {
            "_id": item["code"],
            "code": item["code"],
            "name": item["name"],
            "short_name": item["short_name"],
            "hod": item["hod"],
            "established_year": item["established_year"],
            "intake": item["intake"],
            "student_count": STUDENTS_PER_DEPARTMENT,
        }
        for item in DEPARTMENTS
    ]


def subjects_for_semester(department_code: str, semester: int) -> list[tuple[str, str, int, int]]:
    return SUBJECT_CATALOG[department_code][semester]


def subjects_by_code(department_code: str, semester: int) -> dict[str, tuple[str, str, int, int]]:
    return {
        subject[0]: subject
        for subject in subjects_for_semester(department_code, semester)
    }
