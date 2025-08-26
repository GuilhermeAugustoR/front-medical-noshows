import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptador para adicionar token nas requisições
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptador para lidar com respostas e refresh de token
// api.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const originalRequest = error.config;

//     if (error.response?.status === 401 && !originalRequest._retry) {
//       originalRequest._retry = true;

//       if (typeof window !== "undefined") {
//         try {
//           const refreshToken = localStorage.getItem("refreshToken");
//           if (refreshToken) {
//             const response = await axios.post<RefreshResponse>(
//               `${api.defaults.baseURL}/auth/refresh`,
//               { refreshToken }
//             );

//             const { token, refreshToken: newRefreshToken } =
//               response.data;

//             localStorage.setItem("token", token);
//             localStorage.setItem("refreshToken", newRefreshToken);

//             if (originalRequest.headers) {
//               originalRequest.headers.Authorization = `Bearer ${token}`;
//             }

//             return api(originalRequest);
//           }
//         } catch (refreshError) {
//           localStorage.removeItem("token");
//           localStorage.removeItem("refreshToken");
//           localStorage.removeItem("user");
//           window.location.href = "/";
//         }
//       }
//     }

//     return Promise.reject(error);
//   }
// );

export default api;
