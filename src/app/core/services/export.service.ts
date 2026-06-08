import { Injectable } from '@angular/core';
import { Question } from '../models/question.model';
import { buildBatches, slugify, todayIsoDate } from '../utils/file-splitter.util';

@Injectable({ providedIn: 'root' })
export class ExportService {
  downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  buildBatches(questions: Question[], maxPerFile: number): Question[][] {
    return buildBatches(questions, maxPerFile);
  }

  buildMarkdownContent(
    batch: Question[],
    partNum: number,
    totalParts: number,
    certName: string,
  ): string {
    const header = this.buildHeader(certName, partNum, totalParts, batch.length);
    const body = batch
      .map((question, index) => this.formatQuestion(question, index + 1))
      .join('\n\n---\n\n');
    return `${header}\n\n${body}\n`;
  }

  buildFilename(
    certName: string,
    suffix: string,
    date: string = todayIsoDate(),
  ): string {
    const certSlug = certName ? slugify(certName) : '';
    const base = certSlug ? `${certSlug}-study-${date}` : `study-${date}`;
    return `${base}-${suffix}.md`;
  }

  private buildHeader(
    certName: string,
    partNum: number,
    totalParts: number,
    count: number,
  ): string {
    const title = certName ? `${certName} Study Notes` : 'IT Certification Study Notes';
    const partLine = totalParts > 1 ? ` — Part ${partNum} of ${totalParts}` : '';
    return `# ${title}${partLine}\n\nGenerated on ${todayIsoDate()}. Contains ${count} reviewed question${count === 1 ? '' : 's'}.`;
  }

  private formatQuestion(question: Question, position: number): string {
    return `## Question ${position} — ${question.domain}\n\n${question.review.trim()}`;
  }
}
