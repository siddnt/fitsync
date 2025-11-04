// Admin panel JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  });
  
  // User search functionality
  const userSearchInput = document.getElementById('userSearch');
  if (userSearchInput) {
    userSearchInput.addEventListener('input', function() {
      filterUsers(this.value);
    });
  }
  
  // Trainer search functionality
  const trainerSearchInput = document.getElementById('trainerSearch');
  if (trainerSearchInput) {
    trainerSearchInput.addEventListener('input', function() {
      filterTrainers(this.value);
    });
  }
  
  // Fetch and display user details in modal
  setupUserDetailsModal();
  
  // Load revenue chart data
  loadRevenueChart();

  // Load analytics charts (sales, gender, age, venn)
  loadAnalyticsCharts();
});

// Filter users based on search input
function filterUsers(searchTerm) {
  searchTerm = searchTerm.toLowerCase();
  const rows = document.querySelectorAll('.user-row');
  
  rows.forEach(row => {
    const name = row.cells[0].textContent.toLowerCase();
    const email = row.cells[1].textContent.toLowerCase();
    
    if (name.includes(searchTerm) || email.includes(searchTerm)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Filter trainers based on search input
function filterTrainers(searchTerm) {
  searchTerm = searchTerm.toLowerCase();
  const rows = document.querySelectorAll('.trainer-row');
  
  rows.forEach(row => {
    const name = row.cells[0].textContent.toLowerCase();
    const email = row.cells[1].textContent.toLowerCase();
    
    if (name.includes(searchTerm) || email.includes(searchTerm)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Setup user details modal functionality
function setupUserDetailsModal() {
  const userDetailsButtons = document.querySelectorAll('.view-user-details');
  const userDetailsModal = document.getElementById('userDetailsModal');
  const userDetailsContent = document.getElementById('userDetailsContent');
  
  if (userDetailsButtons.length && userDetailsModal && userDetailsContent) {
    userDetailsButtons.forEach(button => {
      button.addEventListener('click', function() {
        const userId = this.getAttribute('data-id');
        
        // Show loading state
        userDetailsContent.innerHTML = `
          <div class="text-center">
            <div class="spinner-border text-danger" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p>Loading user details...</p>
          </div>
        `;
        
        // Open the modal
        const modal = new bootstrap.Modal(userDetailsModal);
        modal.show();
        
        // Fetch user details
        fetch(`/admin/users/details/${userId}`)
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              const user = data.user;
              
              // Format registration date
              const registrationDate = new Date(user.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              });
              
              // Render plans list
              let plansHtml = '';
              if (user.plans && user.plans.length > 0) {
                plansHtml = '<ul class="list-group list-group-flush bg-dark">';
                user.plans.forEach(plan => {
                  plansHtml += `
                    <li class="list-group-item bg-dark text-light border-secondary">
                      <strong>${plan.title}</strong> - ${plan.category}
                      <span class="badge bg-info float-end">${plan.duration}</span>
                    </li>
                  `;
                });
                plansHtml += '</ul>';
              } else {
                plansHtml = '<p>No active plans</p>';
              }
              
              // Render recent bookings
              let bookingsHtml = '';
              if (user.recentBookings && user.recentBookings.length > 0) {
                bookingsHtml = '<ul class="list-group list-group-flush bg-dark">';
                user.recentBookings.forEach(booking => {
                  let statusClass = 'bg-info';
                  if (booking.status === 'completed') statusClass = 'bg-success';
                  if (booking.status === 'cancelled') statusClass = 'bg-danger';
                  
                  bookingsHtml += `
                    <li class="list-group-item bg-dark text-light border-secondary">
                      ${new Date(booking.date).toLocaleDateString()} at ${booking.time}
                      <span class="badge ${statusClass} float-end">${booking.status}</span>
                      <div class="small text-muted">Trainer: ${booking.trainer}</div>
                    </li>
                  `;
                });
                bookingsHtml += '</ul>';
              } else {
                bookingsHtml = '<p>No recent bookings</p>';
              }
              
              // Update the modal content with user details
              userDetailsContent.innerHTML = `
                <div class="row">
                  <div class="col-md-6">
                    <div class="user-profile-header mb-4">
                      <div class="display-6">${user.name}</div>
                      <div class="text-muted">${user.email}</div>
                    </div>
                    
                    <h5>Personal Information</h5>
                    <div class="row mb-3">
                      <div class="col-6">
                        <div class="mb-2"><strong>Gender:</strong></div>
                        <div>${user.gender}</div>
                      </div>
                      <div class="col-6">
                        <div class="mb-2"><strong>Age:</strong></div>
                        <div>${user.age}</div>
                      </div>
                    </div>
                    
                    <div class="mb-3">
                      <div class="mb-2"><strong>Member Since:</strong></div>
                      <div>${registrationDate}</div>
                    </div>
                  </div>
                  
                  <div class="col-md-6">
                    <h5>Active Plans</h5>
                    <div class="mb-3">
                      ${plansHtml}
                    </div>
                    
                    <h5>Recent Bookings</h5>
                    <div>
                      ${bookingsHtml}
                    </div>
                  </div>
                </div>
              `;
            } else {
              userDetailsContent.innerHTML = `
                <div class="alert alert-danger">
                  Failed to load user details. Please try again.
                </div>
              `;
            }
          })
          .catch(error => {
            console.error('Error fetching user details:', error);
            userDetailsContent.innerHTML = `
              <div class="alert alert-danger">
                An error occurred while loading user details. Please try again.
              </div>
            `;
          });
      });
    });
  }
}

// Fetch revenue data and update the pie charts
function loadRevenueChart() {
  // Make sure we have all chart elements before proceeding
  const courseRevenueChart = document.getElementById('courseRevenueChart');
  const shopRevenueChart = document.getElementById('shopRevenueChart');
  const totalRevenueChart = document.getElementById('totalRevenueChart');
  
  if (!courseRevenueChart || !shopRevenueChart || !totalRevenueChart) return; // Skip if not on dashboard page
  
  // Show loading state for all charts
  const charts = [courseRevenueChart, shopRevenueChart, totalRevenueChart];
  charts.forEach(chart => {
    const chartContainer = chart.parentElement;
    chartContainer.innerHTML = `
      <div class="text-center position-absolute top-50 start-50 translate-middle w-100">
        <div class="spinner-border text-danger" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-light mt-2">Loading revenue data...</p>
      </div>
      <canvas id="${chart.id}"></canvas>
    `;
  });
  
  // Fetch revenue data from API
  fetch('/admin/api/revenue')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Restore canvas elements
        document.getElementById('courseRevenueChart').parentElement.innerHTML = '<canvas id="courseRevenueChart"></canvas>';
        document.getElementById('shopRevenueChart').parentElement.innerHTML = '<canvas id="shopRevenueChart"></canvas>';
        document.getElementById('totalRevenueChart').parentElement.innerHTML = '<canvas id="totalRevenueChart"></canvas>';
        
        const courseCanvas = document.getElementById('courseRevenueChart');
        const shopCanvas = document.getElementById('shopRevenueChart');
        const totalCanvas = document.getElementById('totalRevenueChart');
        
        // Define color arrays for consistent styling
        const backgroundColors = [
          '#28a745', // green
          '#ffc107', // yellow
          '#dc3545', // red
          '#17a2b8', // cyan
          '#6610f2', // purple
          '#fd7e14', // orange
          '#20c997'  // teal
        ];
        
        // Create Course Revenue Chart
        createCourseRevenueChart(courseCanvas, data.data.courseRevenue, backgroundColors);
        
        // Create Shop Revenue Chart
        createShopRevenueChart(shopCanvas, data.data.shopRevenue, backgroundColors);
        
        // Create Total Revenue Chart
        createTotalRevenueChart(totalCanvas, data.data.totalRevenue, backgroundColors);
        
        // Update revenue totals display
        updateRevenueTotals(data.data.totalRevenue);
      } else {
        showChartError('courseRevenueChart');
        showChartError('shopRevenueChart');
        showChartError('totalRevenueChart');
      }
    })
    .catch(error => {
      console.error('Error fetching revenue data:', error);
      showChartError('courseRevenueChart');
      showChartError('shopRevenueChart');
      showChartError('totalRevenueChart');
    });
}

// Create course revenue chart
function createCourseRevenueChart(canvas, courseData, backgroundColors) {
  // Process data for chart
  const courseNames = courseData.map(course => course.courseName);
  const revenueAmounts = courseData.map(course => course.totalAmount);
  
  // Create chart
  new Chart(canvas, {
    type: 'pie',
    data: {
      labels: courseNames,
      datasets: [{
        data: revenueAmounts,
        backgroundColor: backgroundColors.slice(0, courseNames.length),
        borderColor: '#212121',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#f5f5f5',
            font: {
              family: "'Poppins', sans-serif",
              size: 12
            },
            padding: 20
          }
        }
      }
    }
  });
  
  // Update the revenue list items
  updateCourseRevenueListItems(courseData);
}

// Create shop revenue chart
function createShopRevenueChart(canvas, shopData, backgroundColors) {
  // Process data for chart
  const categoryNames = shopData.map(item => item.category);
  const revenueAmounts = shopData.map(item => item.totalAmount);
  
  // Create chart
  new Chart(canvas, {
    type: 'pie',
    data: {
      labels: categoryNames,
      datasets: [{
        data: revenueAmounts,
        backgroundColor: backgroundColors.slice(0, categoryNames.length),
        borderColor: '#212121',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#f5f5f5',
            font: {
              family: "'Poppins', sans-serif",
              size: 12
            },
            padding: 20
          }
        }
      }
    }
  });
  
  // Update the revenue list items
  updateShopRevenueListItems(shopData);
}

// Create total revenue chart
function createTotalRevenueChart(canvas, totalData, backgroundColors) {
  // Create chart
  new Chart(canvas, {
    type: 'pie',
    data: {
      labels: ['Course Revenue', 'Shop Revenue'],
      datasets: [{
        data: [totalData.courseRevenue, totalData.shopRevenue],
        backgroundColor: [backgroundColors[0], backgroundColors[1]],
        borderColor: '#212121',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#f5f5f5',
            font: {
              family: "'Poppins', sans-serif",
              size: 12
            },
            padding: 20
          }
        }
      }
    }
  });
}

// Show error message when chart loading fails
function showChartError(chartId) {
  const chartContainer = document.getElementById(chartId).parentElement;
  chartContainer.innerHTML = `
    <div class="alert alert-danger">
      Failed to load revenue data. Please try again.
    </div>
  `;
}

// Update the course revenue list items with actual data
function updateCourseRevenueListItems(courses) {
  const listContainer = document.querySelector('.list-group-courses');
  if (!listContainer) return;
  
  // Clear existing items
  listContainer.innerHTML = '';
  
  // Create background color classes for badges
  const bgClasses = ['bg-success', 'bg-warning', 'bg-danger', 'bg-info', 'bg-primary', 'bg-secondary'];
  
  // Add items for each course
  courses.forEach((course, index) => {
    const bgClass = bgClasses[index % bgClasses.length];
    const formattedAmount = formatCurrency(course.totalAmount);
    
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
    listItem.innerHTML = `
      ${course.courseName}
      <span class="badge ${bgClass}">${formattedAmount}</span>
    `;
    
    listContainer.appendChild(listItem);
  });
  
  // If no courses with revenue, show a message
  if (courses.length === 0 || courses.every(course => course.totalAmount === 0)) {
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item';
    listItem.textContent = 'No course revenue data available';
    listContainer.appendChild(listItem);
  }
}

// Update the shop revenue list items with actual data
function updateShopRevenueListItems(categories) {
  const listContainer = document.querySelector('.list-group-shop');
  if (!listContainer) return;
  
  // Clear existing items
  listContainer.innerHTML = '';
  
  // Create background color classes for badges
  const bgClasses = ['bg-success', 'bg-warning', 'bg-danger', 'bg-info', 'bg-primary', 'bg-secondary'];
  
  // Add items for each category
  categories.forEach((category, index) => {
    const bgClass = bgClasses[index % bgClasses.length];
    const formattedAmount = formatCurrency(category.totalAmount);
    
    // Capitalize the first letter of each word
    const categoryName = category.category.replace(/\b\w/g, l => l.toUpperCase());
    
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
    listItem.innerHTML = `
      ${categoryName}
      <span class="badge ${bgClass}">${formattedAmount}</span>
    `;
    
    listContainer.appendChild(listItem);
  });
  
  // If no categories with revenue, show a message
  if (categories.length === 0 || categories.every(cat => cat.totalAmount === 0)) {
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item';
    listItem.textContent = 'No shop revenue data available';
    listContainer.appendChild(listItem);
  }
}

// Update revenue totals display
function updateRevenueTotals(totals) {
  const courseTotal = document.getElementById('course-revenue-total');
  const shopTotal = document.getElementById('shop-revenue-total');
  const total = document.getElementById('total-revenue');
  
  if (courseTotal) courseTotal.textContent = formatCurrency(totals.courseRevenue);
  if (shopTotal) shopTotal.textContent = formatCurrency(totals.shopRevenue);
  if (total) total.textContent = formatCurrency(totals.total);
}

// Format currency for display
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Analytics: fetch and render charts
function loadAnalyticsCharts() {
  const lineCanvas = document.getElementById('salesLineChart');
  const genderCanvas = document.getElementById('genderChart');
  const ageCanvas = document.getElementById('ageHistogram');
  const vennContainer = document.getElementById('trainerVennContainer');
  if (!lineCanvas || !genderCanvas || !ageCanvas || !vennContainer) return;

  // Loading states
  lineCanvas.parentElement.innerHTML = `<div class="text-center position-absolute top-50 start-50 translate-middle w-100"><div class="spinner-border text-danger" role="status"><span class="visually-hidden">Loading...</span></div><p class="text-light mt-2">Loading sales data...</p></div><canvas id="salesLineChart"></canvas>`;
  genderCanvas.parentElement.innerHTML = `<div class="text-center position-absolute top-50 start-50 translate-middle w-100"><div class="spinner-border text-danger" role="status"><span class="visually-hidden">Loading...</span></div></div><canvas id="genderChart"></canvas>`;
  ageCanvas.parentElement.innerHTML = `<div class="text-center position-absolute top-50 start-50 translate-middle w-100"><div class="spinner-border text-danger" role="status"><span class="visually-hidden">Loading...</span></div></div><canvas id="ageHistogram"></canvas>`;
  vennContainer.innerHTML = `<div class="text-center position-absolute top-50 start-50 translate-middle w-100"><div class="spinner-border text-danger" role="status"><span class="visually-hidden">Loading...</span></div></div>`;

  fetch('/admin/api/analytics')
    .then(r => r.json())
    .then(payload => {
      if (!payload.success) throw new Error('analytics failed');
  const { sales, demographics, trainerVenn } = payload.data;

      // Restore canvases
      document.getElementById('salesLineChart').parentElement.innerHTML = '<canvas id="salesLineChart"></canvas>';
      document.getElementById('genderChart').parentElement.innerHTML = '<canvas id="genderChart"></canvas>';
      document.getElementById('ageHistogram').parentElement.innerHTML = '<canvas id="ageHistogram"></canvas>';

      const salesCtx = document.getElementById('salesLineChart').getContext('2d');
      const genderCtx = document.getElementById('genderChart').getContext('2d');
      const ageCtx = document.getElementById('ageHistogram').getContext('2d');

      // Build Sales Line Chart with toggle
      let currentMode = 'weekly';
      let salesChart;
      const upsertSalesChart = () => {
        const src = currentMode === 'weekly' ? sales.weekly : sales.monthly;
        if (salesChart) salesChart.destroy();
        salesChart = new Chart(salesCtx, {
          type: 'line',
          data: {
            labels: src.labels,
            datasets: [
              {
                label: 'Course Revenue',
                data: src.course,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40,167,69,0.2)',
                tension: 0.3
              },
              {
                label: 'Shop Revenue',
                data: src.shop,
                borderColor: '#ffc107',
                backgroundColor: 'rgba(255,193,7,0.2)',
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { color: '#f5f5f5' } },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y || 0)}`
                }
              }
            },
            scales: {
              x: { ticks: { color: '#ddd' }, grid: { color: 'rgba(255,255,255,0.08)' } },
              y: { ticks: { color: '#ddd', callback: (v) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v) }, grid: { color: 'rgba(255,255,255,0.08)' } }
            }
          }
        });
      };
      upsertSalesChart();

      const weeklyBtn = document.getElementById('toggle-weekly');
      const monthlyBtn = document.getElementById('toggle-monthly');
      if (weeklyBtn && monthlyBtn) {
        weeklyBtn.addEventListener('click', () => {
          currentMode = 'weekly';
          weeklyBtn.classList.add('active');
          monthlyBtn.classList.remove('active');
          upsertSalesChart();
        });
        monthlyBtn.addEventListener('click', () => {
          currentMode = 'monthly';
          monthlyBtn.classList.add('active');
          weeklyBtn.classList.remove('active');
          upsertSalesChart();
        });
      }

      // Gender Doughnut
      const genderData = demographics.gender;
      new Chart(genderCtx, {
        type: 'doughnut',
        data: {
          labels: ['Male', 'Female', 'Other', 'Unknown'],
          datasets: [{
            data: [genderData.male, genderData.female, genderData.other, genderData.unknown],
            backgroundColor: ['#0d6efd', '#e83e8c', '#20c997', '#6c757d'],
            borderColor: '#212121'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: '#f5f5f5' } } }
        }
      });

      // Age Histogram (Bar)
      new Chart(ageCtx, {
        type: 'bar',
        data: {
          labels: demographics.ageHistogram.bins,
          datasets: [{
            label: 'Users',
            data: demographics.ageHistogram.counts,
            backgroundColor: '#17a2b8'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#ddd' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            y: { ticks: { color: '#ddd' }, grid: { color: 'rgba(255,255,255,0.08)' } }
          }
        }
      });

      // Trainer Venn Diagram
      renderTrainerVenn(trainerVenn);

      // Totals badges
      const courseBadge = document.getElementById('total-course-badge');
      const shopBadge = document.getElementById('total-shop-badge');
      const allBadge = document.getElementById('total-all-badge');
      if (courseBadge) courseBadge.textContent = formatCurrency(sales.totals.course);
      if (shopBadge) shopBadge.textContent = formatCurrency(sales.totals.shop);
      if (allBadge) allBadge.textContent = formatCurrency(sales.totals.total);
    })
    .catch(err => {
      console.error('Analytics error:', err);
      // Soft-fail: replace containers with message
      const errHtml = '<div class="alert alert-danger">Failed to load analytics.</div>';
      const line = document.getElementById('salesLineChart');
      const gender = document.getElementById('genderChart');
      const age = document.getElementById('ageHistogram');
      const venn = document.getElementById('trainerVennContainer');
      if (line) line.parentElement.innerHTML = errHtml;
      if (gender) gender.parentElement.innerHTML = errHtml;
      if (age) age.parentElement.innerHTML = errHtml;
      if (venn) venn.innerHTML = errHtml;
    });
}

function renderTrainerVenn(data) {
  const container = document.getElementById('trainerVennContainer');
  if (!container || !window.venn) return;
  container.innerHTML = '';
  try {
    const chart = window.venn.VennDiagram().width(container.clientWidth).height(container.clientHeight);
    const d3sel = window.d3.select(container);
    d3sel.datum(data).call(chart);
    d3sel.selectAll('text').style('fill', '#f5f5f5');
  } catch (e) {
    console.error('Venn render error', e);
    container.innerHTML = '<div class="alert alert-secondary">No overlap data</div>';
  }
}