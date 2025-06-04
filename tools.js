const fs = require('fs');
const path = require('path');

// Load staff directory
let staffDirectory;
try {
  const staffData = fs.readFileSync(path.join(__dirname, 'staff-directory.json'), 'utf8');
  staffDirectory = JSON.parse(staffData);
} catch (error) {
  console.error('Error loading staff directory:', error);
  staffDirectory = { staff: [] };
}

// Tool definitions
const tools = [
  {
    name: 'lookup_staff_directory',
    description: 'Look up staff information from the company directory. This tool provides comprehensive contact information, roles, departments, and organizational structure for all company employees. Use this when users ask about staff members, contact information, who works in what department, reporting structure, or any employee-related queries. The tool returns all staff data, which you can then filter and present based on the user\'s specific request.',
    input_schema: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: ['all', 'by_name', 'by_department', 'by_role'],
          description: 'The type of lookup to perform. Use "all" to get complete directory, "by_name" to search for specific person, "by_department" to find people in a department, "by_role" to find people with specific roles.'
        },
        search_term: {
          type: 'string',
          description: 'The search term to use when query_type is not "all". For names, use partial or full names. For departments, use department names like "Engineering", "Sales", etc. For roles, use job titles.'
        }
      },
      required: ['query_type']
    }
  },
  {
    name: 'company_calculator',
    description: 'Perform various business and mathematical calculations including basic arithmetic, percentage calculations, budget analysis, ROI calculations, salary calculations, and financial projections. Use this tool whenever users need mathematical computations, financial analysis, or business-related calculations. This tool can handle complex multi-step calculations and provides detailed breakdowns.',
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['basic_math', 'percentage', 'budget_analysis', 'roi_calculation', 'salary_calculation', 'compound_interest', 'break_even'],
          description: 'The type of calculation to perform'
        },
        values: {
          type: 'object',
          description: 'The input values needed for the calculation. Structure varies by operation type.',
          additionalProperties: true
        },
        description: {
          type: 'string',
          description: 'Optional description of what this calculation is for (e.g., "Q4 budget analysis", "Marketing ROI")'
        }
      },
      required: ['operation', 'values']
    }
  }
];

// Staff directory lookup function
function lookupStaffDirectory(input) {
  const { query_type, search_term } = input;
  
  switch (query_type) {
    case 'all':
      return JSON.stringify(staffDirectory, null, 2);
    
    case 'by_name':
      if (!search_term) {
        return 'Error: search_term is required for name lookup';
      }
      const nameResults = staffDirectory.staff.filter(person => 
        person.name.toLowerCase().includes(search_term.toLowerCase())
      );
      return JSON.stringify({ staff: nameResults }, null, 2);
    
    case 'by_department':
      if (!search_term) {
        return 'Error: search_term is required for department lookup';
      }
      const deptResults = staffDirectory.staff.filter(person => 
        person.department.toLowerCase().includes(search_term.toLowerCase())
      );
      return JSON.stringify({ staff: deptResults }, null, 2);
    
    case 'by_role':
      if (!search_term) {
        return 'Error: search_term is required for role lookup';
      }
      const roleResults = staffDirectory.staff.filter(person => 
        person.role.toLowerCase().includes(search_term.toLowerCase())
      );
      return JSON.stringify({ staff: roleResults }, null, 2);
    
    default:
      return 'Error: Invalid query_type. Use "all", "by_name", "by_department", or "by_role"';
  }
}

// Company calculator function
function companyCalculator(input) {
  const { operation, values, description } = input;
  
  try {
    let result = {};
    
    switch (operation) {
      case 'basic_math':
        if (values.expression) {
          // Simple expression evaluation (be careful with eval in production)
          const sanitized = values.expression.replace(/[^0-9+\-*/.() ]/g, '');
          result = {
            expression: values.expression,
            result: eval(sanitized),
            description: description || 'Basic calculation'
          };
        } else if (values.numbers && values.operator) {
          const nums = values.numbers;
          let calc_result;
          switch (values.operator) {
            case '+': calc_result = nums.reduce((a, b) => a + b, 0); break;
            case '-': calc_result = nums.reduce((a, b) => a - b); break;
            case '*': calc_result = nums.reduce((a, b) => a * b, 1); break;
            case '/': calc_result = nums.reduce((a, b) => a / b); break;
            default: throw new Error('Invalid operator');
          }
          result = {
            numbers: nums,
            operator: values.operator,
            result: calc_result,
            description: description || 'Basic calculation'
          };
        }
        break;
        
      case 'percentage':
        if (values.total && values.part) {
          const percentage = (values.part / values.total) * 100;
          result = {
            part: values.part,
            total: values.total,
            percentage: Math.round(percentage * 100) / 100,
            description: description || 'Percentage calculation'
          };
        } else if (values.amount && values.percentage) {
          const calculated = values.amount * (values.percentage / 100);
          result = {
            amount: values.amount,
            percentage: values.percentage,
            result: Math.round(calculated * 100) / 100,
            description: description || 'Percentage of amount'
          };
        }
        break;
        
      case 'budget_analysis':
        const income = values.income || 0;
        const expenses = values.expenses || [];
        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const remaining = income - totalExpenses;
        
        result = {
          income: income,
          expenses: expenses,
          total_expenses: totalExpenses,
          remaining_budget: remaining,
          budget_utilization: Math.round((totalExpenses / income) * 100 * 100) / 100,
          status: remaining >= 0 ? 'Within Budget' : 'Over Budget',
          description: description || 'Budget analysis'
        };
        break;
        
      case 'roi_calculation':
        const investment = values.investment || 0;
        const returns = values.returns || 0;
        const roi = ((returns - investment) / investment) * 100;
        
        result = {
          investment: investment,
          returns: returns,
          profit: returns - investment,
          roi_percentage: Math.round(roi * 100) / 100,
          description: description || 'ROI calculation'
        };
        break;
        
      case 'salary_calculation':
        const annual = values.annual_salary || 0;
        const hours_per_week = values.hours_per_week || 40;
        const weeks_per_year = values.weeks_per_year || 52;
        
        result = {
          annual_salary: annual,
          monthly_salary: Math.round((annual / 12) * 100) / 100,
          weekly_salary: Math.round((annual / weeks_per_year) * 100) / 100,
          daily_salary: Math.round((annual / (weeks_per_year * 5)) * 100) / 100,
          hourly_rate: Math.round((annual / (weeks_per_year * hours_per_week)) * 100) / 100,
          description: description || 'Salary breakdown'
        };
        break;
        
      case 'compound_interest':
        const principal = values.principal || 0;
        const rate = values.annual_rate || 0;
        const time = values.years || 0;
        const compound_frequency = values.compound_frequency || 1;
        
        const amount = principal * Math.pow(1 + (rate/100) / compound_frequency, compound_frequency * time);
        const interest_earned = amount - principal;
        
        result = {
          principal: principal,
          annual_rate: rate,
          years: time,
          compound_frequency: compound_frequency,
          final_amount: Math.round(amount * 100) / 100,
          interest_earned: Math.round(interest_earned * 100) / 100,
          description: description || 'Compound interest calculation'
        };
        break;
        
      case 'break_even':
        const fixed_costs = values.fixed_costs || 0;
        const variable_cost_per_unit = values.variable_cost_per_unit || 0;
        const price_per_unit = values.price_per_unit || 0;
        
        const contribution_margin = price_per_unit - variable_cost_per_unit;
        const break_even_units = fixed_costs / contribution_margin;
        const break_even_revenue = break_even_units * price_per_unit;
        
        result = {
          fixed_costs: fixed_costs,
          variable_cost_per_unit: variable_cost_per_unit,
          price_per_unit: price_per_unit,
          contribution_margin: Math.round(contribution_margin * 100) / 100,
          break_even_units: Math.round(break_even_units * 100) / 100,
          break_even_revenue: Math.round(break_even_revenue * 100) / 100,
          description: description || 'Break-even analysis'
        };
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return JSON.stringify({
      calculation_type: operation,
      result: result,
      timestamp: new Date().toISOString()
    }, null, 2);
    
  } catch (error) {
    return JSON.stringify({
      error: `Calculation error: ${error.message}`,
      operation: operation,
      provided_values: values
    }, null, 2);
  }
}

// Main function to execute tools
function executeTool(toolName, input) {
  switch (toolName) {
    case 'lookup_staff_directory':
      return lookupStaffDirectory(input);
    case 'company_calculator':
      return companyCalculator(input);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Get staff directory stats for logging
function getStaffStats() {
  return {
    count: staffDirectory.staff.length,
    departments: [...new Set(staffDirectory.staff.map(person => person.department))].length
  };
}

module.exports = {
  tools,
  executeTool,
  getStaffStats
}; 