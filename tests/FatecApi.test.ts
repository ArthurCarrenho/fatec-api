import * as chai from "chai";
import * as mocha from "mocha";

import Calendar from "models/Calendar";
import Discipline from "models/Discipline";
import Evaluation from "models/Evaluation";
import History from "models/History";
import SchoolGrade from "models/SchoolGrade";

import {getAccount} from "./helpers.js";

const expect = chai.expect;
let account: any;

before((done) => {
  account = getAccount();
  done();
});

describe("fatec-api", () => {
  const studentDisciplines = [];
  let accountDisciplines = [];
  let getNameDelay = 0;

  before((done) => {
    account.login().then(() => {
      done();
    }).catch((message) => {
      console.error(message.stack);
      done(message);
    });
  });

  describe("account", () => {

    it("should login", () => {
      const anotherInstance = getAccount();
      return anotherInstance.login().then(() => {
        expect(anotherInstance.isLogged()).equal(true);
        expect(anotherInstance.cookie.length > 0).equal(true);
      });
    });

    it("should get name", () => {
      getNameDelay = +new Date();
      return account.getName().then((name) => {
        getNameDelay = +new Date() - getNameDelay;
        expect(name).equal(process.env.NAME);
      });
    });

    it("should get profile", () => {
      return account.getProfile().then((profile) => {
        expect(profile).to.have.property("name");
        expect(profile).to.have.property("averageGrade");
        expect(profile).to.have.property("progress");
        expect(profile).to.have.property("course");
        expect(profile).to.have.property("unit");
        expect(profile).to.have.property("period");
        expect(profile).to.have.property("code");
        expect(profile).to.have.property("cpf");
        expect(profile).to.have.property("birthday");
        expect(profile).to.have.property("email");
        expect(profile).to.have.property("picture");
        expect(profile.name).to.be.a("string");
        expect(profile.averageGrade).to.be.a("number");
        expect(profile.progress).to.be.a("number");
        expect(profile.course).to.be.a("string");
        expect(profile.unit).to.be.a("string");
        expect(profile.period).to.be.a("string");
        expect(profile.code).to.be.a("string");
        expect(profile.picture).to.be.a("string");
        expect(profile.cpf).to.be.a("string");
        expect(profile.birthday).to.be.instanceof(Date);
        expect(profile.email).to.be.a("string");
      });
    });
    it("should get cached name", () => {
      let cachedDelay = +new Date();
      return account.getName().then((name) => {
        cachedDelay = +new Date() - cachedDelay;
        expect(getNameDelay * 0.1 > cachedDelay).equal(true);
      });
    });
    it("should get registeredEmails", () => {
      return account.getRegisteredEmails().then((registeredEmails) => {
        expect(registeredEmails.length > 0).to.equal(true);
        expect(registeredEmails[0]).to.have.property("email");
        const emailIntegrations = ["fatec", "etec", "preferential", "websai"];
        for (const email of registeredEmails) {
          if (email.integrations && email.integrations.length) {
            for (const integration of email.integrations) {
              expect(emailIntegrations).to.contains(integration);
            }
          }
        }
      });
    });
    it("should get it partial grades", () => {
      return account.getPartialGrades().then((partialGrades) => {
        if (partialGrades.length) {
          for (const partialGrade of partialGrades) {
              expect(partialGrade.discipline.name).to.be.a("string");
              expect(partialGrade.discipline.code).to.be.a("string");
              expect(partialGrade.discipline.frequency).to.be.a("number");
              expect(partialGrade.discipline.grade).to.be.a("number");
              expect(partialGrade.evaluations).to.be.a("array");
              for (const evaluation of partialGrade.evaluations) {
                expect(evaluation.title).to.be.a("string");
                expect(evaluation.grade).to.be.a("number");
                expect(evaluation.releaseDate).to.be.a("string");
                expect(evaluation.weight).to.be.a("number");
              }
          }
        }
      });
    });
    it("should have enrolled disciplines", () => {
      return account.getEnrolledDisciplines().then((disciplines) => {
        accountDisciplines = disciplines;
        if (disciplines.length) {
          for (const discipline of disciplines) {
            expect(discipline.getAbsenses()).to.be.a("number");
            expect(discipline.getName()).to.be.a("string");
            expect(discipline.getCode()).to.be.a("string");
            expect(discipline.getClassroomId()).to.be.a("number");
            expect(discipline.getClassroomCode()).to.be.a("string");
            expect(discipline.getPeriodId()).to.be.a("number");
            expect(discipline.getCourseId()).to.be.a("number");
            expect(discipline.getPresences()).to.be.a("number");
            expect(discipline.getTeacherId()).to.be.a("number");
            expect(discipline.getTeacherName()).to.be.a("string");
          }
        }
      });
    });
    it("should have schedules", () => {
      return account.getSchedules().then((days) => {
        expect(days).to.be.an("array");
        expect(days).to.be.lengthOf(6);
        for (const day of days) {
          expect(day).to.have.property("periods");
          expect(day).to.have.property("weekday");
          expect(day.periods).to.be.an("array");
          expect(day.weekday).to.be.a("number");
          for (const period of day.periods) {
            expect(period).to.have.property("startAt");
            expect(period).to.have.property("endAt");
            expect(period).to.have.property("discipline");
            expect(period.startAt).to.be.a("date");
            expect(period.endAt).to.be.a("date");
            expect(period.discipline).to.be.a.instanceof(Discipline);
            expect(period.discipline.getClassroomCode()).to.be.a("string");
          }
        }
      });
    });
    it("should have history", () => {
      return account.getHistory().then((history) => {
        expect(history).to.be.instanceOf(History);
        const entries = history.getEntries();
        if (entries.length) {
          for (const entry of entries) {
            expect(entry).to.have.property("discipline");
            expect(entry).to.have.property("observation");

            expect(entry.discipline).to.be.a.instanceOf(Discipline);
            expect(entry.discipline.getPeriod()).to.be.a("string");
            expect(entry.discipline.getGrade()).to.be.a("number");
            expect(entry.discipline.getFrequency()).to.be.a("number");
            expect(entry.discipline.getAbsenses()).to.be.a("number");
            expect(entry.discipline.isApproved()).to.be.a("boolean");
            expect(entry.observation).to.be.a("string");
          }
        }
      });
    });
    it("should have school grade", () => {
      return account.getSchoolGrade().then((schoolGrade) => {
        expect(schoolGrade).to.be.instanceOf(SchoolGrade);
        const semesters = schoolGrade.getSemesters();
        expect(semesters).to.be.an("array");
        if (semesters.length) {
          for (const semester of semesters) {
            expect(semester).to.have.property("number");
            expect(semester).to.have.property("disciplines");
            expect(semester.number).to.be.a("number");
            if (semester.disciplines.length) {
              for (const discipline of semester.disciplines) {
                expect(discipline).to.be.instanceOf(Discipline);
              }
            }
          }
        }
      });
    });
    it("should have academic calendar", () => {
      return account.getAcademicCalendar().then((calendar) => {
        expect(calendar).to.be.instanceOf(Calendar);
        const months = calendar.getMonths();
        expect(months.length).to.equal(12);
        for (const month of months) {
          expect(month).to.be.an("object");
          expect(month).to.have.property("events");
          expect(month.events).to.be.an("array");

          if (month.events.length) {
            for (const event of month.events) {
              expect(event).to.have.property("date");
              expect(event).to.have.property("name");
              expect(event).to.have.property("reason");
              expect(event.name).to.be.a("string");
              expect(event.reason).to.be.a("string");
              expect(event.date).to.be.a("date");
            }
          }
        }
      });
    });
  });
  describe("student", () => {
    it("should get name", () => {
      const name = account.student.getName();
      expect(name).equal(process.env.NAME);
    });

    it("should get profile", () => {
      const profile = account.student.getProfile();
      expect(profile).to.have.property("name");
      expect(profile).to.have.property("averageGrade");
      expect(profile).to.have.property("progress");
      expect(profile).to.have.property("course");
      expect(profile).to.have.property("unit");
      expect(profile).to.have.property("period");
      expect(profile).to.have.property("code");
      expect(profile.name).to.be.a("string");
      expect(profile.averageGrade).to.be.a("number");
      expect(profile.progress).to.be.a("number");
      expect(profile.course).to.be.a("string");
      expect(profile.unit).to.be.a("string");
      expect(profile.period).to.be.a("string");
      expect(profile.code).to.be.a("string");
    });

    it("should get registeredEmails", () => {
      const registeredEmails = account.student.getRegisteredEmails();
      expect(registeredEmails.length > 0).to.equal(true);
      expect(registeredEmails[0]).to.have.property("email");
      const emailIntegrations = ["fatec", "etec", "preferential", "websai"];
      for (const email of registeredEmails) {
        if (email.integrations && email.integrations.length) {
          for (const integration of email.integrations) {
            expect(emailIntegrations).to.contains(integration);
          }
        }
      }
    });
    it("should have enrolled disciplines", () => {
      const enrolledDisciplines = account.student.getEnrolledDisciplines();
      expect(enrolledDisciplines.length === studentDisciplines.length);
      enrolledDisciplines.forEach((discipline) => {
        if (accountDisciplines.length) {
          expect(accountDisciplines.filter((_discipline) => {
            return _discipline.getPresences() === discipline.getPresences() &&
                   _discipline.getAbsenses() === discipline.getAbsenses() &&
                   +_discipline.getQuitDate() === +discipline.getQuitDate() &&
                   _discipline.getCode() === discipline.getCode();
          }).length === 1);
        }
      });
      if (enrolledDisciplines.length) {
        for (const discipline of enrolledDisciplines) {
          expect(discipline.getAbsenses()).to.be.a("number");
          expect(discipline.getName()).to.be.a("string");
          expect(discipline.getCode()).to.be.a("string");
          expect(discipline.getClassroomId()).to.be.a("number");
          expect(discipline.getClassroomCode()).to.be.a("string");
          expect(discipline.getPeriodId()).to.be.a("number");
          expect(discipline.getCourseId()).to.be.a("number");
          expect(discipline.getPresences()).to.be.a("number");
          expect(discipline.getTeacherId()).to.be.a("number");
          expect(discipline.getTeacherName()).to.be.a("string");
        }
      }
    });

    it("should have schedules", () => {
      const schedules = account.student.getSchedules();
      expect(schedules).to.be.an("array");
      expect(schedules).to.be.lengthOf(6);
      for (const day of schedules) {
        expect(day).to.have.property("periods");
        expect(day).to.have.property("weekday");
        expect(day.periods).to.be.an("array");
        expect(day.weekday).to.be.a("number");
        for (const period of day.periods) {
          expect(period).to.have.property("startAt");
          expect(period).to.have.property("endAt");
          expect(period).to.have.property("discipline");
          expect(period.startAt).to.be.a("date");
          expect(period.endAt).to.be.a("date");
          expect(period.discipline).to.be.a.instanceof(Discipline);
          expect(period.discipline.getClassroomCode()).to.be.a("string");
        }
      }
    });

    it("should have history", () => {
      const history = account.student.getHistory();
      expect(history).to.be.instanceOf(History);
      const entries = history.getEntries();
      if (entries.length) {
        for (const entry of entries) {
          expect(entry).to.have.property("discipline");
          expect(entry).to.have.property("observation");

          expect(entry.discipline).to.be.a.instanceOf(Discipline);
          expect(entry.discipline.getPeriod()).to.be.a("string");
          expect(entry.discipline.getGrade()).to.be.a("number");
          expect(entry.discipline.getFrequency()).to.be.a("number");
          expect(entry.discipline.getAbsenses()).to.be.a("number");
          expect(entry.discipline.isApproved()).to.be.a("boolean");
          expect(entry.observation).to.be.a("string");
        }
      }
    });

    it("should have school grade", () => {
      const schoolGrade = account.student.getSchoolGrade();
      expect(schoolGrade).to.be.instanceOf(SchoolGrade);
      const semesters = schoolGrade.getSemesters();
      expect(semesters).to.be.an("array");
      for (const semester of semesters) {
        expect(semester).to.have.property("number");
        expect(semester).to.have.property("disciplines");
        if (semester.disciplines.length) {
          for (const discipline of semester.disciplines) {
            expect(["approved", "attending", "not-attended", "dismissed", "dismissed-ae"]).to.contain(discipline.getState());
          }
        }
      }
    });

    it("should have academic calendar", () => {
      const calendar = account.student.getAcademicCalendar();
      expect(calendar).to.be.instanceOf(Calendar);
      const months = calendar.getMonths();
      expect(months.length).to.equal(12);
      for (const month of months) {
        expect(month).to.be.an("object");
        expect(month).to.have.property("events");
        expect(month.events).to.be.an("array");

        if (month.events.length) {
          for (const event of month.events) {
            expect(event).to.have.property("date");
            expect(event).to.have.property("name");
            expect(event).to.have.property("reason");
            expect(event.name).to.be.a("string");
            expect(event.reason).to.be.a("string");
            expect(event.date).to.be.a("date");
          }
        }
      }
    });
  });
});
