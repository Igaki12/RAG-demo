export type DemoAccount = {
  email: string;
  password: string;
  displayName: string;
};

export const demoAccounts: DemoAccount[] = [
  {
    email: 'student.alpha+demo01@example.com',
    password: 'NewsQuest#01',
    displayName: 'Student Alpha'
  },
  {
    email: 'analyst.bravo+demo02@example.com',
    password: 'NewsQuest#02',
    displayName: 'Analyst Bravo'
  },
  {
    email: 'mentor.charlie+demo03@example.com',
    password: 'NewsQuest#03',
    displayName: 'Mentor Charlie'
  }
];

export function findAccountByEmail(email: string) {
  return demoAccounts.find((account) => account.email.toLowerCase() === email.toLowerCase());
}
