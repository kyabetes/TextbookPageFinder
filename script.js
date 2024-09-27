pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

async function findEquivalentPage() {
    const teacherPdf = document.getElementById('teacherPdf').files[0];
    const studentPdf = document.getElementById('studentPdf').files[0];
    const teacherPage = parseInt(document.getElementById('teacherPage').value);
    const resultDiv = document.getElementById('result');
    const progressDiv = document.getElementById('progress');

    if (!teacherPdf || !studentPdf || !teacherPage) {
        resultDiv.textContent = 'Please provide all required inputs.';
        return;
    }

    try {
        progressDiv.textContent = 'Processing...';
        const teacherText = await extractTextFromPdf(teacherPdf, teacherPage);
        const teacherSentences = getFirstSentences(teacherText, 4);
        let threshold = 0.7;  // start with a slightly lower threshold
        let studentPageNumber = null;

        while (threshold >= 0.3 && !studentPageNumber) {
            progressDiv.textContent = `Searching with similarity threshold: ${threshold.toFixed(2)}`;
            studentPageNumber = await findBestMatchingPage(studentPdf, teacherSentences, threshold, progressDiv);
            threshold -= 0.1;
        }

        if (studentPageNumber) {
            resultDiv.textContent = `The best matching page in your edition is: ${studentPageNumber}`;
        } else {
            resultDiv.textContent = 'Could not find a sufficiently similar page. Please try again with a different page number.';
        }
    } catch (error) {
        resultDiv.textContent = `An error occurred: ${error.message}`;
    } finally {
        progressDiv.textContent = '';
    }
}

async function extractTextFromPdf(file, pageNumber) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    return textContent.items.map(item => item.str).join(' ');
}

function getFirstSentences(text, count) {
    const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [];
    return sentences.slice(0, count).join(' ');
}

async function findBestMatchingPage(file, searchText, threshold, progressDiv) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let bestMatch = { similarity: 0, page: null };

    for (let i = 1; i <= pdf.numPages; i++) {
        progressDiv.textContent = `Comparing page ${i} of ${pdf.numPages}...`;
        const pageText = await extractTextFromPdf(file, i);
        const similarity = findBestSimilarityInPage(searchText, pageText);

        if (similarity > bestMatch.similarity) {
            bestMatch = { similarity, page: i };
        }

        if (similarity >= threshold) {
            return bestMatch.page;
        }
    }

    return bestMatch.similarity >= threshold ? bestMatch.page : null;
}

function findBestSimilarityInPage(searchText, pageText) {
    const windowSize = searchText.split(/\s+/).length;
    const pageWords = pageText.split(/\s+/);
    let bestSimilarity = 0;

    for (let i = 0; i <= pageWords.length - windowSize; i++) {
        const windowText = pageWords.slice(i, i + windowSize).join(' ');
        const similarity = calculateSimilarity(searchText, windowText);
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
        }
    }

    return bestSimilarity;
}

function calculateSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    return intersection.size / Math.max(set1.size, set2.size);
}