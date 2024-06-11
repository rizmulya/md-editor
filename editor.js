// PARTS
const getInputs = () => ({
    username: elements.username.value,
    repo: elements.repo.value,
    filePath: elements.filePath.value,
    token: elements.token.value,
    branch: elements.branch.value
});

(function applyStyle() {
    const style = document.createElement('style');
    style.textContent = `
        [disabled] {
            background-color: #d1d5db; /* gray-300 */
            color: #4b5563;           /* gray-700 */
            cursor: not-allowed;
            opacity: 0.6;
        }
    `;
    document.head.appendChild(style);
})();

const toggleDirectory = (() => {
    let directoryFetched = false;
    let directoryData = [];

    const fetchDirectory = async (button) => {
        button.disabled = true;
        const { username, repo, token } = getInputs();
        const url = `https://api.github.com/repos/${username}/${repo}/contents/${elements.filePath.value}`;

        doFetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            }
        }, {
            onSuccess: (data) => {
                directoryData = data;
                populateDirectoryList();
            },
            onError: alert,
            onFinish: () => { button.disabled = false; }
        })
    };

    const populateDirectoryList = () => {
        const listElement = elements.dirList;
        listElement.innerHTML = '';

        directoryData.forEach(item => {
            const listItem = document.createElement('li');
            listItem.textContent = `${item.name}`;
            listItem.style.cursor = 'pointer';

            listItem.onclick = () => {
                elements.dirContainer.style.display = 'none';
                elements.dirBtn.textContent = 'Show';
                elements.filePath.value = `${elements.filePath.value}${item.name}`;
            };

            listElement.appendChild(listItem);
        });
    };

    return async (button) => {
        if (!directoryFetched) {
            await fetchDirectory(button);
            directoryFetched = true;
        }

        if (elements.dirContainer.style.display === 'none') {
            elements.dirContainer.style.display = 'block';
            elements.dirBtn.textContent = 'Hide';
        } else {
            elements.dirContainer.style.display = 'none';
            elements.dirBtn.textContent = 'Show';
        }
    };
})();

const resetFilePath = () => {
    elements.filePath.value = inputsToRemember.find(i => i.input === elements.filePath).defaultValue;
};

const togglePushButton = (() => {
    elements.pushBtn.disabled = elements.commitMessage.value.length === 0;
    elements.commitMessage.addEventListener("input", () => {
        elements.pushBtn.disabled = elements.commitMessage.value.length === 0;
    });
})();

const syncContent = async (button) => {
    button.disabled = true;
    const { username, repo, filePath, token } = getInputs();
    const url = `https://api.github.com/repos/${username}/${repo}/contents/${filePath}`;

    doFetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
        }
    }, {
        onSuccess: (data) => {
            const decodedContent = atob(data.content);
            elements.content.value = decodedContent;
        },
        onError: (error) => {
            alert(error);
            const key = inputsToRemember.find(i => i.input === elements.content).identifier;
            localStorage.removeItem(key);
            location.reload();
        },
        onFinish: () => { button.disabled = false; }
    });
};

const deleteFile = async (button) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    button.disabled = true;

    const { username, repo, filePath, token, branch } = getInputs();
    const url = `https://api.github.com/repos/${username}/${repo}/contents/${filePath}`;

    doFetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
            message: `Deleting file: ${filePath}`,
            sha: await getSha(url, token),
            branch
        })
    }, {
        onSuccess: () => alert('File deleted successfully.'),
        onError: alert,
        onFinish: () => {
            const key = inputsToRemember.find(i => i.input === elements.content).identifier;
            localStorage.removeItem(key);
            location.reload();
        }
    });
};

const pushToGitHub = async (button) => {
    button.disabled = true;
    const { username, repo, branch, token, filePath } = getInputs();

    if (!elements.content.value) {
        button.disabled = false;
        return alert("Content is empty");
    }

    const encodedContent = btoa(elements.content.value);
    const url = `https://api.github.com/repos/${username}/${repo}/contents/${filePath}`;

    doFetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: elements.commitMessage.value,
            content: encodedContent,
            branch,
            sha: await getSha(url, token)
        })
    }, {
        onSuccess: () => alert('File pushed successfully.'),
        onError: alert,
        onFinish: () => {
            const key = inputsToRemember.find(i => i.input === elements.content).identifier;
            localStorage.removeItem(key);
            location.reload();
        }
    });
};

// UTILS
// input utils
const remember = ((inputsToRemember) => {
    const rememberInput = ({ input, identifier, defaultValue = null }) => {
        const key = 'your-key-is-here';
        const storedValue = localStorage.getItem(identifier);

        if (storedValue) {
            const bytes = CryptoJS.AES.decrypt(storedValue, key);
            input.value = bytes.toString(CryptoJS.enc.Utf8);
        } else if (defaultValue !== null) {
            input.value = defaultValue;
        }

        input.addEventListener("input", e => {
            const encryptedValue = CryptoJS.AES.encrypt(e.target.value, key).toString();
            localStorage.setItem(identifier, encryptedValue);
        });
    };

    inputsToRemember.forEach(config => rememberInput(config));
})(inputsToRemember);

// api utils
const doFetch = async (url, options, { onSuccess, onError, onFinish = () => { } }) => {
    try {
        const response = await fetch(url, options);
        if (response.ok) {
            const data = await response.json();
            onSuccess(data);
        } else {
            onError(`Error code: ${response.status}`);
        }
    } catch (error) {
        onError('Network or other error');
    } finally {
        onFinish();
    }
};

// github sha utils
const getSha = async (url, token) => {
    const response = await fetch(url, {
        headers: { 'Authorization': `token ${token}` }
    });
    if (response.ok) {
        const data = await response.json();
        return data.sha;
    }
    return null;
};

(function handleEnterCharacter() {
    elements.content.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            const start = this.selectionStart;
            this.value = this.value.substring(0, start) + "\n" + this.value.substring(start);
            this.selectionStart = this.selectionEnd = start + 1;
            e.preventDefault();
        }
    });
})();