interface IGrade {
  releaseDate: Date;
  grade: number;
}
interface IApplyDate {
  predicted: Date;
  applied: Date;
  published: Date;
}

export default class Evaluation {

  private weight: number;
  private code: string;
  private title: string;
  private description: string;
  private grades: IGrade[];
  private applyDates: IApplyDate;

  constructor ({ code, description, title, weight }: {
    code: string,
    description: string,
    // grades: IGrade[],
    title: string,
    weight: number,
  }) {
    this.description = description;
    this.code = code;
    this.title = title;
    this.weight = weight;
  }

  public setWeight (weight: number): void {
    this.weight = weight;
  }

  public getWeight (): number {
    return this.weight;
  }

  public setCode (code: string): void {
    this.code = code;
  }

  public getCode (): string {
    return this.code;
  }

  public setTitle (title: string): void {
    this.title = title;
  }

  public getTitle (): string {
    return this.title;
  }

  public setDescription (description: string): void {
    this.description = description;
  }

  public getDescription (): string {
    return this.description;
  }

  public setGrades (grades: IGrade[]): void {
    this.grades = grades;
  }

  public getGrades (): IGrade[] {
    return this.grades;
  }

  public setApplyDates (applydates: IApplyDate): void {
    this.applyDates = applydates;
  }

  public getApplyDates (): IApplyDate {
    return this.applyDates;
  }

}
