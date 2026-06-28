type EmployeeSeed = {
  firstName: string;
  middleName: string;
  surname: string;
  dateOfBirth: string;
  gender: "Male" | "Female";
  designationName: string;
  seniorityRank: number;
  panNumber: string;
  contactNumber: string;
  customFieldValue: string;
};

export type EmployeeSeedWithDisplay = EmployeeSeed & {
  displayName: string;
};

export type RunContext = {
  suffix: string;
  customFieldLabel: string;
  designationNames: {
    headmaster: string;
    teacher: string;
    associate: string;
  };
  employees: {
    headmaster: EmployeeSeedWithDisplay;
    teacherA: EmployeeSeedWithDisplay;
    teacherB: EmployeeSeedWithDisplay;
    associate: EmployeeSeedWithDisplay;
  };
  editedAssociate: {
    designationName: string;
    seniorityRank: number;
    customFieldValue: string;
  };
};

function buildEmployee(seed: EmployeeSeed): EmployeeSeedWithDisplay {
  return {
    ...seed,
    displayName: `${seed.surname} ${seed.firstName} ${seed.middleName}`.trim(),
  };
}

export function createRunContext(): RunContext {
  const suffix = `pb${Date.now().toString(36)}`;
  const designationNames = {
    headmaster: `Headmaster ${suffix}`,
    teacher: `Teacher ${suffix}`,
    associate: `Associate ${suffix}`,
  };

  return {
    suffix,
    customFieldLabel: `Staff Code ${suffix}`,
    designationNames,
    employees: {
      headmaster: buildEmployee({
        firstName: "Aditi",
        middleName: `Madhav ${suffix}`,
        surname: "Gokhale",
        dateOfBirth: "1986-02-14",
        gender: "Female",
        designationName: designationNames.headmaster,
        seniorityRank: 1,
        panNumber: `PAN-${suffix}-1`,
        contactNumber: `900000${suffix.slice(-4).padStart(4, "0")}`,
        customFieldValue: `SC-${suffix}-1`,
      }),
      teacherA: buildEmployee({
        firstName: "Bhushan",
        middleName: `Nitin ${suffix}`,
        surname: "Apte",
        dateOfBirth: "1989-04-03",
        gender: "Male",
        designationName: designationNames.teacher,
        seniorityRank: 1,
        panNumber: `PAN-${suffix}-2`,
        contactNumber: `911111${suffix.slice(-4).padStart(4, "0")}`,
        customFieldValue: `SC-${suffix}-2`,
      }),
      teacherB: buildEmployee({
        firstName: "Chinmay",
        middleName: `Sachin ${suffix}`,
        surname: "Sathe",
        dateOfBirth: "1991-08-22",
        gender: "Male",
        designationName: designationNames.teacher,
        seniorityRank: 1,
        panNumber: `PAN-${suffix}-3`,
        contactNumber: `922222${suffix.slice(-4).padStart(4, "0")}`,
        customFieldValue: `SC-${suffix}-3`,
      }),
      associate: buildEmployee({
        firstName: "Esha",
        middleName: `Mahesh ${suffix}`,
        surname: "Deshmukh",
        dateOfBirth: "1993-11-09",
        gender: "Female",
        designationName: designationNames.associate,
        seniorityRank: 2,
        panNumber: `PAN-${suffix}-4`,
        contactNumber: `933333${suffix.slice(-4).padStart(4, "0")}`,
        customFieldValue: `SC-${suffix}-4`,
      }),
    },
    editedAssociate: {
      designationName: designationNames.teacher,
      seniorityRank: 3,
      customFieldValue: `SC-${suffix}-4-EDIT`,
    },
  };
}
