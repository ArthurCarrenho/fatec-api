import * as cheerio from "cheerio";
import Network from "core/Network";
import Parser from "core/Parser";
import Util from "core/Util";
import Calendar from "models/Calendar";
import Discipline from "models/Discipline";
import Evaluation from "models/Evaluation";
import History from "models/History";
import Schedule from "models/Schedule";
import SchoolGrade from "models/SchoolGrade";
import Student from "models/Student";
import { EmailIntegration } from "models/Student";

export default class Account {

  private static readonly STATES = {
    DENIED: 1,
    IDLE: 0,
    LOGGED: 2,
  };

  public username: string;
  public password: string;
  public cookie: string = "";
  public state: number = Account.STATES.IDLE;

  public student: Student = new Student();

  constructor (username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  public isLogged (): boolean {
    return this.state === Account.STATES.LOGGED;
  }

  public isDenied (): boolean {
    return this.state === Account.STATES.DENIED;
  }

  public isIdle (): boolean {
    return this.state === Account.STATES.IDLE;
  }

  public login (): Promise<any> {
    return Network.post({
      form: {
        BTCONFIRMA: "Confirmar",
        GXState: `{"_EventName":"E'EVT_CONFIRMAR'.","_EventGridId":"","_EventRowId":"",` +
                 `"MPW0005_CMPPGM":"login_top.aspx","MPW0005GX_FocusControl":"","vSAIDA` +
                 `":"","vREC_SIS_USUARIOID":"","GX_FocusControl":"vSIS_USUARIOID","GX_A` +
                 `JAX_KEY":"8E52B5B99D70A87D9EE89570291ACC86","AJAX_SECURITY_TOKEN":"A8` +
                 `B9DECE0E27179FF4F5F08F98769E720CB87ABB4460CC4A68C467A81BF554BB","GX_C` +
                 `MP_OBJS":{"MPW0005":"login_top"},"sCallerURL":"","GX_RES_PROVIDER":"G` +
                 `XResourceProvider.aspx","GX_THEME":"GeneXusX","_MODE":"","Mode":"","I` +
                 `sModified":"1"}`,
        vSIS_USUARIOID: this.username,
        vSIS_USUARIOSENHA: this.password,
      },
      route: Network.ROUTES.LOGIN,
    })
      .catch((err) => {
        if (err.statusCode === Network.STATUS.REDIRECT) {
          this.state = Account.STATES.LOGGED;
          this.cookie = Network.getCookieFromResponse(err.response);
        } else {
          this.state = Account.STATES.DENIED;
        }
      })
      .then((html) => {
        // No HTML code means got redirected therefore logged in
        if (!html) {
          return;
        }

        this.state = Account.STATES.DENIED;
        const $ = cheerio.load(html);
        return {erro: "Login invalido"};
      });
  }

  public getName (): Promise<string> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.HOME,
        scrapper: ($) => {
          const name = String($("#span_MPW0041vPRO_PESSOALNOME").text()) || "" ;
          this.student.setName(name.replace("-", "").trim());
          return this.student.getName();
        },
      });
    });
  }

  public getAvisos (): Promise<string> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.HOME,
        scrapper: ($) => {
          const html = String($("#TABLE100_MPAGE").html().replace(`img src="`,
          `img src="https://siga.cps.sp.gov.br/aluno/`))
           || "" ;
          this.student.setAvisos(html);
          return this.student.getAvisos();
        },
      });
    });
  }

  public getCalendarioProvas (): Promise<string> {
    const prom = this.checkCookie();
    const cprova = [];
    const cd = [];
    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.CALENDARIO_PROVAS,
        scrapper: ($) => {
         const disci = JSON.parse($(('input[name="Grid1ContainerDataV"]'))[0].attribs.value.replace(/"",/g, ""));
         $('input[name^="Grid2ContainerDataV_"]').each(function () {
          const cpp = [];
          for (const iterator of JSON.parse(this.attribs.value)) {
            cpp.push({
              data: iterator[2].replace("  /  /   ", ""),
              name: iterator[1],
            });
          }
          cprova.push(cpp);
          });
         for (let i = 0; i < disci.length; i++) {
            cd.push({
              aval: cprova[i],
              cod: disci[i][0],
              nome: disci[i][1],
            });
          }
         return (cd);
        },
      });
    });
  }

  public getProfile (): Promise<object> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.HOME,
        scrapper: ($) => {
          const data = Parser.parseGxState($("[name=GXState]").val());
          const prefix = Util.getPrefixProperties(data);

          const profile: any = {
            averageGrade: Parser.strNumber(data[`${prefix}vACD_ALUNOCURSOINDICEPR`]),
            code: data[`${prefix}vACD_ALUNOCURSOREGISTROACADEMICOCURSO`],
            course: data["vACD_CURSONOME_MPAGE"],
            name: data[`${prefix}vPRO_PESSOALNOME`].replace(" -", ""),
            period: data["vACD_PERIODODESCRICAO_MPAGE"],
            progress: Parser.strNumber(data[`${prefix}vACD_ALUNOCURSOINDICEPP`]),
            unit: data["vUNI_UNIDADENOME_MPAGE"],
          };

          return Network.get({
            isImage: true,
            route: $(`#${prefix}FOTO > img`).attr("src"),
          }).then((buffer) => {
            profile.picture = Parser.image(Buffer.from(buffer));

            return Network.scrap({
              cookie: this.cookie,
              route: Network.ROUTES.EXCHANGE_PROGRAMS,
              scrapper: ($exchange) => {
                profile.email = $exchange("#span_vPRO_PESSOALEMAIL").text();
                profile.cpf = $exchange("#span_vPRO_PESSOALDOCSCPF").text();
                profile.birthday = Parser.strDate($exchange("#span_vPRO_PESSOALDATANASCIMENTO").text());
                this.student.setProfile(profile);
                return this.student.getProfile();
              },
            });
          });
        },
      });
    });
  }

  public getAcademicCalendar (): Promise<any> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.ACADEMIC_CALENDAR,
        scrapper: ($$) => {
          return Network.scrap({
            cookie: this.cookie,
            route: $$('[name="Embpage1"]').attr("src"),
            scrapper: ($) => {
              const thisYear = (new Date()).getFullYear();
              const months = [
                "W0002JANEIRO",
                "W0002FEVEREIRO",
                "W0002MARCO",
                "W0002ABRIL",
                "W0002MAIO",
                "W0002JUNHO",
                "W0002JULHO",
                "W0002AGOSTO",
                "W0002SETEMBRO",
                "W0002OUTUBRO",
                "W0002NOVEMBRO",
                "W0002DEZEMBRO",
              ];
              const calendar = months.map((month, monthIndex) => {
                let events = $(`#${month} tr > td:not([bgcolor="#FFFF00"]) > font[color="#FF0000"]`).contents();
                events = events.map((i, e) => e.data).get();
                return {
                  events: events.reduce((_events, event) => {
                    event = event.trim();
                    if (event.length) {
                      event = event.split("-");
                      event = {
                        date: new Date(thisYear, monthIndex, Parser.strNumber(event[0])),
                        name: event[1].trim(),
                        reason: event[2].trim(),
                      };
                      _events.push(event);
                    }
                    return _events;
                  }, []),
                };
              });

              this.student.setAcademicCalendar(new Calendar(calendar));
              return this.student.getAcademicCalendar();
            },
          });
        },
      });
    });
  }

  public getSchoolGrade (): Promise<any> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.SCHOOL_GRADE,
        scrapper: ($) => {
          const semesters = $("#TABLE1 table [valign=TOP]").map((i, el) => {
            const item: any = {};
            item.number = i + 1;
            item.disciplines = $(el).find(":scope div").map((_, div) => {
              const $discipline = $(div);
              const data = $discipline.find("tr td").map((__i, td) => {
                const $td = $(td);
                const str = $td.text().trim();
                if (str.indexOf("NF:") > -1) {
                  return [
                    $td.contents().not($td.children()).text(),
                  ].concat($td.find("b").map((___i, b) => $(b).text().trim()).get());
                }
                return str;
              }).get();

              const stateCodes = {
                "#418a58": "dismissed",
                "#75fa9f": "approved",
                "#96ffd2": "dismissed-ae",
                "#b2d4fd": "attending",
                "#ffffff": "not-attended",
              };

              const state: any = stateCodes[$discipline.css("background-color").toLowerCase()];
              const discipline: any = {
                classHours: Parser.strNumber(data[1].replace("AS:", "")),
                code: data[0],
                name: data[2],
                state,
              };

              if (data.length > 3) {
                discipline.period = data[6];
                discipline.frequency = Parser.strNumber(data[5]);
                discipline.grade = Parser.strNumber(data[4]);
              }

              return new Discipline(discipline);
            }).get();

            return item;
          }).get();

          this.student.setSchoolGrade(new SchoolGrade(semesters));
          return this.student.getSchoolGrade();
        },
      });
    });
  }

  public getHistory (): Promise<any> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.HISTORY,
        scrapper: ($) => {
          const data = JSON.parse($("[name=Grid1ContainerDataV]").attr("value"));
          const approvedCheckboxStr = "Resources/checkTrue.png";
          const entries = data.map((entry) => {
            const discipline: any = { code: entry[0], name: entry[1] };
            const observation = entry[7];

            if (entry[3] === approvedCheckboxStr) {
              discipline.state = "approved";
            } else if (observation === "Em Curso") {
              discipline.state = "attending";
            } else {
              discipline.state = "not-attended";
            }
            discipline.approved = discipline.state === "approved";
            discipline.absenses = Parser.strNumber(entry[6]);
            discipline.frequency = Parser.strNumber(entry[5]);
            discipline.grade = Parser.strNumber(entry[4]);
            discipline.period = entry[2];

            return {
              discipline: new Discipline(discipline),
              observation,
            };
          });
          this.student.setHistory(new History(entries));
          return this.student.getHistory();
        },
      });
    });
  }

  public getSchedules (): Promise<any> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.SCHEDULE,
        scrapper: ($) => {
          const tags = [
            "[name='Grid2ContainerDataV']",
            "[name='Grid3ContainerDataV']",
            "[name='Grid4ContainerDataV']",
            "[name='Grid5ContainerDataV']",
            "[name='Grid6ContainerDataV']",
            "[name='Grid7ContainerDataV']",
          ];
          const schedules = tags.map((tag, index) => {
            const data = JSON.parse($(tag).attr("value"));

            return {
              periods: data.map((period) => {
                let [startAt, endAt] = period[1].split("-");
                const now = new Date();
                const periodTime = new Date();

                now.setMilliseconds(0);
                now.setSeconds(0);
                periodTime.setMilliseconds(0);
                periodTime.setSeconds(0);
                const [startHours, startMinutes] = startAt.split(":");
                const [endHours, endMinutes] = endAt.split(":");
                const weekday = index + 1;
                const isSameWeekday = now.getDay() === weekday;

                periodTime.setMinutes(parseInt(startMinutes));
                periodTime.setHours(parseInt(startHours));

                if ((isSameWeekday && +now > +periodTime) || (now.getDay() > weekday)) {
                  now.setDate(now.getDate() + 7);
                } else {
                  now.setDate(now.getDate() + (weekday - now.getDay()));
                }

                startAt = new Date(+now);
                startAt.setMinutes(parseInt(startMinutes));
                startAt.setHours(parseInt(startHours));

                endAt = new Date(+now);
                endAt.setMinutes(parseInt(endMinutes));
                endAt.setHours(parseInt(endHours));

                const discipline = new Discipline({ code: period[2], classroomCode: period[3] });

                return { discipline, endAt, startAt };
              }),
              weekday: index + 1,
            };
          });

          this.student.setSchedules(schedules.map((s) => new Schedule(s)));
          return this.student.getSchedules();
        },
      });
    });
  }

  public getRegisteredEmails (): Promise<any> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.HOME,
        scrapper: ($) => {
          const email = $("#span_vPRO_PESSOALEMAIL").text();
          const emailFatec = $("#span_MPW0041vINSTITUCIONALFATEC").text();
          const emailEtec = $("#span_MPW0041vINSTITUCIONALETEC").text();
          const emailWebsai = $("#span_vEMAILWEBSAI").text();
          this.student.setRegisteredEmails([{
              email,
              integration: EmailIntegration.preferential,
            },
            {
              email: emailFatec,
              integration: EmailIntegration.fatec,
            },
            {
              email: emailEtec,
              integration: EmailIntegration.etec,
            },
            {
              email: emailWebsai,
              integration: EmailIntegration.websai,
            },
          ]);
          return this.student.getRegisteredEmails();
        },
      });
    });
  }

  public getPartialGrades (): Promise<any> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.PARTIAL_GRADES,
        scrapper: ($) => {
          const tag = $("[name=xGXState]");
          let data = $("[name=GXState]").val();
          data = JSON.parse(data.replace(/\\>/g, "&gt")).vACD_ALUNONOTASPARCIAISRESUMO_SDT;
          // console.log(JSON.stringify(data));
          this.student.setPartialGrades(data.map((line) => {
            const discipline = new Discipline({
              code: line["ACD_DisciplinaSigla"],
              frequency: line["ACD_AlunoHistoricoItemFrequencia"],
              grade: line["ACD_AlunoHistoricoItemMediaFinal"],
              name: line["ACD_DisciplinaNome"],
            });
            return {
              discipline,
              evaluations: line["Datas"].map((evaluation) => {
                let grade;

                if (typeof(evaluation["Avaliacoes"][0]) === "undefined") {
                   grade = {
                     grade: -1,
                     releaseDate: "",
                  };
                } else {
                  grade = {
                    grade: evaluation["Avaliacoes"][0]["ACD_PlanoEnsinoAvaliacaoParcialNota"],
                    releaseDate: evaluation["Avaliacoes"][0]["ACD_PlanoEnsinoAvaliacaoParcialDataLancamento"],
                  };
                }
                return new Evaluation({
                  code: evaluation["ACD_PlanoEnsinoAvaliacaoSufixo"],
                  description: evaluation["ACD_PlanoEnsinoAvaliacaoDescricao"],
                  grade: grade["grade"],
                  releaseDate: grade["releaseDate"],
                  title: evaluation["ACD_PlanoEnsinoAvaliacaoTitulo"],
                  weight: Parser.strNumber(evaluation["ACD_PlanoEnsinoAvaliacaoPeso"]),
                });
              }),
            };
          }));
          return this.student.getPartialGrades();
        },
      });
    });
  }

  public getEnrolledDisciplines (): Promise<any> {
    const prom = this.checkCookie();

    return prom.then(() => {
      return Network.scrap({
        cookie: this.cookie,
        route: Network.ROUTES.PARTIAL_ABSENSES,
        scrapper: ($$) => {
          let data = $$("[name=GXState]").val();
          data = JSON.parse(data.replace(/\\>/g, "&gt")).vFALTAS;

          return Network.scrap({
            cookie: this.cookie,
            route: Network.ROUTES.SCHEDULE,
            scrapper: ($) => {
              let scheduleData = $("[name=GXState]").val();
              scheduleData = JSON.parse(scheduleData.replace(/\\>/g, "&gt")).vALU_ALUNOHISTORICOITEM_SDT;
              this.student.setEnrolledDisciplines(data.map((line) => {
                const scheduleDiscipline = scheduleData.filter((d) => {
                  return d["ACD_DisciplinaSigla"] === line["ACD_DisciplinaSigla"].trim();
                })[0];

                return new Discipline({
                  absenses: line["TotalAusencias"],
                  classroomCode: scheduleDiscipline["ACD_TurmaLetra"],
                  classroomId: line["ACD_AlunoHistoricoItemTurmaId"],
                  code: line["ACD_DisciplinaSigla"].trim(),
                  courseId: line["ACD_AlunoHistoricoItemCursoId"],
                  name: line["ACD_DisciplinaNome"],
                  periodId: line["ACD_Periodoid"],
                  presences: line["TotalPresencas"],
                  teacherId: line["ACD_AlunoHistoricoItemProfessorId"],
                  teacherName: scheduleDiscipline["Pro_PessoalNome"],
                });
              }));
              return this.student.getEnrolledDisciplines();
            },
          });
        },
      });
    });
  }

  private checkCookie (): Promise<void> {
    if (!this.isLogged()) {
      return this.login();
    }
    return Promise.resolve();
  }
}
