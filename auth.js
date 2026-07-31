window.GaneshAuth = (() => {
    const SESSION_KEY = 'ganesh_staff_user';
    const user = () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    const signOut = () => localStorage.removeItem(SESSION_KEY);
    const requireLogin = () => {
        if (user()) return true;
        const destination = `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.search}`;
        window.location.href = `login.html?returnTo=${encodeURIComponent(destination)}`;
        return false;
    };
    const addUser = formData => formData.append('Updated By', user()?.name || '');
    return { user, signOut, requireLogin, addUser };
})();
